---
title: ChatGPT iMessage Bot
description: TODO
draft: false
date: 2023-06-02
tags:
  - project
---
You can't cross the street these days without seeing a new chatbot in development in yet another place
where it's entirely uneeded. The whole thing reminded me of a simpler time, when something that went where
it wasn't supposed to, you took a picture of it and captioned "if i fits, i sits". Meme homebrewed and relevant.
![[catgpt.jpg]]

Anyway! How cool would it be if instead of using ChatGPT to write your history papers in the tone of historical figures,
you leveraged it for a far more selfish use case. A personal assistant. I think it's only a matter of time until 
(or maybe it already exists) where your messaging platform drafts your whole response and all you have to do is consent + send = consend it. 
Well since apple seems to be sitting on their heels, I took matters into my own hands. 

Turns out that if you use MacOS and sync your messages with iCloud, all your messages live in an SQLite folder in `~/Library/Messages/chat.db`... unencrypted... 
So my plan was to simply query the database periodically for new messages, find a new one, seek the oracle (aka gpt-3) for wisdom, and then send that. 
It turns out... it's entirely that easy. I will still walk you through the project but if you don't want to read anymore, [check out the github here.](https://github.com/SilasStokes/pymessage_gpt_bot)

So the first step is understanding the schema of `chat.db` so it can be queried. I played around with DB Browser for SQLite and came up with the following query that I was happy with:

```SQL
SELECT
	datetime((message.date / 1000000000) + 978307200, 'unixepoch', 'localtime') as _date,
	message.text,
	handle.id as phone_num,
	handle.service as protocol,
	message.destination_caller_id as dest,
	CASE
		WHEN message.is_from_me  = 1 THEN 'Y'
		ELSE 'N'
	END AS from_me
FROM 
	message
JOIN 
	handle ON message.handle_id=handle.ROWID
ORDER BY
	message.date DESC
LIMIT 50;
```

Which works awesome. Except if you run it on your own machine you'll notice two things... first the `text` field is often null, second the results are missing group messages. I only noticed the groupchat one because I have a motivation message automation I send my friends every morning at 6am and noticed it was missing. 

![[qry_results1.png]]

While scanning the `messages` table I found that the missing texts are located in the `attributedBody` field as a binary blob embedded in what looks like swift code, I've underlined one example in red. Also the groupchat I thought was missing is underlined in green. 

![[null_body_missing_group_msg.png]]

Groupchats were missing simply because `handle.id` is null for groupchat. By searching the whole database for groupchat name that I know I have I found that the name is stored in the `chat` table and the problem was solved in SQL with the addition of `LEFT JOIN chat ON message.cache_roomnames=chat.chat_identifier`. 

I unfortunately don't grok SQL enough to even begin to know if I could extract the `text` from the `attributedBody` field so it is time to introduce python. I found [imessage_reader](https://github.com/niftycode/imessage_reader) as a great starting point - I was originally going to write my own little library but I have been trying to read more code and contribute to open source more so off the shelf the solution it is. Looking at the query inside `imessage_reader`, in the `fetch_data.py` file:

```python
class FetchData:
    SQL_CMD = "SELECT " \
                "text, " \
                "datetime((date / 1000000000) + 978307200, 'unixepoch', 'localtime')," \
                "handle.id, " \
                "handle.service, " \
                "message.destination_caller_id, " \
                "message.is_from_me "\
              "FROM message " \
              "JOIN handle on message.handle_id=handle.ROWID"

    def __init__(self, system=None):
        ...

    def _read_database(self) -> list:
        rval = common.fetch_db_data(self.DB_PATH, self.SQL_CMD)
        data = []
        for row in rval:
            data.append(MessageData(row[2], row[0], row[1], row[3], row[4], row[5]))
        return data
```

looks like we want to update the `_read_database` function. Just as a test, I ran the library as is and counted how many `text` fields had a null value, and off the 90k record I had, 10k were null. Wow. 

By carefully examining the output from the `attributedBody` field I was able to see that they all followed a general pattern of:
```
streamtypedè@NSMutableAttributedStringNSAttributedStringNSObjectNSMutableStringNSString+-THE TEXT MESSAGEiI-NSDictionaryi__kIMMessagePartAttributeNameNSNumberNSValue*
```
with some small inconsistencies. Most notably, I noticed that the byte(s) preceeding the text were often the length of the text, so I am assuming that this is a binary dump of the swift object that holds the text message. By sheer amount of time examining the ouput I noticed that if the bytes began with `'\x81'` then the length of the text was stored as two bytes in little endianness and otherwise the length was stored as a single byte. So after stripping some of the leading junk I came up with this new function:

```python
    def _read_database(self, sql_cmd:str = SQL_CMD) -> list[data_container.MessageData]:
        """
        Fetch data from the database and store the data in a list.
        :return: List containing the user id, messages, the service and the account
        """

        rval = common.fetch_db_data(self.DB_PATH, sql_cmd)
        # rval indices
        # 0. text message
        # 1. date
        # 2. phone_number/handle_id
        # 3. handle_service
        # 4. destination caller id
        # 5. message from me as 1 = from me, 0 = no
        # 6. attributedBody (contains text if index 0 is null)
        # 7. cache roomnames - groupchat identifier
        # 8. group chat display name

        data = []
        for row in rval:
            text = row[0]
            # the chatdb has some weird behavior where sometimes the text value is None
            # and the text string is buried in an binary blob under the attributedBody field.
            if text is None and row[6] is not None:
                try:
                    text = row[6].split(b'NSString')[1]
                    text = text[5:] # stripping some preamble which generally looks like this: b'\x01\x94\x84\x01+'
                    
                    if text[0] == 129: # this 129 is b'\x81, python indexes byte strings as ints, this is equivalent to text[0:1] == b'\x81'
                        length = int.from_bytes(text[1:3], 'little') 
                        text = text[3:length  + 3]
                    else:
                        length = text[0]
                        text = text[1:length + 1]
                    text = text.decode()
                except Exception as e:
                    pass
                    
            recipient = row[2] if not row[8] else row[8]

            data.append(
                data_container.MessageData(
                    recipient, text, row[1], row[3], row[4], row[5]
                )
            )

        return data
```

The parsing worked on all but 190 text messages, which on a query of 90k, I was okay with. I put the code [in a pull request](https://github.com/niftycode/imessage_reader/pull/14), and the author said "good addition" when they accepted and merged it. :satisfaction.gif:

Finally to make`imessage_reader` usuable I added some functionality to parameterize the query, currently the library returns a list of lists of every row in `chat.db`, I absolutely don't want to load 90k text records every query and then sort them in python. I think I'll just let SQL do that. My plan is to check for new text messages every minute so I added a `get_messages_between_dates` function. 

```python
class FetchData:
    SQL_CMD = (
        "SELECT "
            "text, "
            "datetime((date / 1000000000) + 978307200, 'unixepoch', 'localtime'),"
            "handle.id, "
            "handle.service, "
            "message.destination_caller_id, "
            "message.is_from_me, "
            "message.attributedBody, "
            "message.cache_roomnames, "
            "chat.display_name "
        "FROM "
            "message "
        "LEFT JOIN "
            "handle on message.handle_id=handle.ROWID "
        "LEFT JOIN "
            # the fix for group mesages
            "chat ON message.cache_roomnames=chat.chat_identifier "
    )
    
    # the rest of FetchData remains untouched... 

    def get_messages_between_dates(self, date_start = None, date_end = None) -> list[data_container.MessageData]:
        """
        Dateformat should be: YYYY-MM-DD HH:MM:SS format, which can be done with the code::

            time.strftime('%Y-%m-%d %H:%M:%S',time.localtime(time.time()))

        and offset with::

            offset = 60 * 60 * 24 * 365 # SECONDS * MINUTES * HOURS * DAYS * YEARS
            time.strftime('%Y-%m-%d %H:%M:%S',time.localtime(time.time() - OFFSET))

        if date_end is not supplied, it will be assumed to be current time.
        If not returning anything, and you suspect it should be, ensure that you dont have start and end flopped. 
        :return:
        """ 
        from time import strftime, localtime, time, strptime

        if date_start is None:
            return None

        try:
            _ = strptime(date_start, '%Y-%m-%d %H:%M:%S')
        except Exception as e:
            raise e


        try:
            _ = strptime(date_end, '%Y-%m-%d %H:%M:%S')
        except Exception as e:
            date_end = strftime('%Y-%m-%d %H:%M:%S',localtime(time())) # date end getting set to current time

        sql_query = self.SQL_CMD + (
            "WHERE "
                "DATETIME((message.date / 1000000000) + 978307200, 'unixepoch', 'localtime') "
                "BETWEEN "
                    f"\"{date_start}\" "
                "AND "
                    f"\"{date_end}\" "
            "ORDER BY "
                "message.date DESC "
            ";"
        )

        return self._read_database(sql_query)
```

I am curious how more experienced developers would go about augmenting the SQL query when encountering a codebase like this. Doing string concatenation with the `SQL_CMD` variable doesn't sit entirely right but I am planning on eventually making a pull request with these additions and didn't want to stray too far from the authors codebase. 

We're finally at a place where we can programmatically check for new text messages. With the additions to `imessage_reader` we can psuedo code how the script is going to work

```python
from imessage_reader import fetch_data
fd = fetch_data.FetchData()
while True:
    # get current time
    # get messages between iteration and current time
    # ask chatpgt to generate a response for the texts
    # send the response
```

Filling in the blanks and adding a config file with our api keys, a gpt prompt and some other settings gets us to:

```python
from imessage_reader import fetch_data
import imessage
import time
import openai
import os
import json
import argparse
from src.models import AutoRespondConfig

parser = argparse.ArgumentParser()
parser.add_argument('--config', default='./src/configs/autoresponder.config.json',
                    help='pass the file path to your keyfile')

cl_args = parser.parse_args()

try:
    with open(cl_args.config) as json_file:
        config = AutoRespondConfig(**json.load(json_file))
except Exception as exc:
    print(
        f'ERROR: check config file - something is broken.{Exception=} {exc=}. Exiting...')
    exit(1)


def generate_response(text_message: str) -> str:
    resp = openai.Completion.create(
        model="text-davinci-003",
        prompt=f'{config.gptprompt}\n{text_message}',
        max_tokens=1000,
        temperature=0
    )
    return f'{resp.choices[0].text.strip()}'


def main():
    fd = fetch_data.FetchData()
    while True:
        logging.debug(f'starting loop: ')
        start_time = time.strftime('%Y-%m-%d %H:%M:%S',time.localtime(time.time() - config.delay_between_loops))
        msgs = fd.get_messages_between_dates(date_start = start_time)

        if not msgs:
            logging.debug(f'\tno messages found')
        for msg in msgs:
            logging.debug(f'\tchecking message {msg.text}')
            if '!bot' not in msg.text or msg.user_id != config.groupchat_name:
                logging.debug(f'\t\tis not a command for the bot, skipping...')
                continue

            msg.text = msg.text.replace('!bot', '').strip()
            logging.debug(f'command received for bot: {msg.text}')

            resp = get_gpt_response(msg.text)
            if config.emoji_pasta:
                resp = emoji_generator.generate_emojipasta(resp)
            resp = f'bot: {resp}'

            imessage.send(config.groupchat_recipients, resp)

        time.sleep(config.delay_between_loops)

if __name__ == "__main__":
    main()
```

Oh - the reason I get to glaze over how to programmatically send an iMessage is because [this repo's solution](https://github.com/kevinschaich/py-imessage-shortcuts) works beautifully. 
![[groupchat_first_message.jpeg]]

This is great. Right now anybody in the groupchat can summon gpt by adding `!bot` to their text. This use case is just like the discord chatbots I've seen. Everyone in my friend group had fun asking gpt questions at my API key's expense.

However, my original goal was to have GPT as my secretary. The way envision that is - when I go to work I set my phone on Do Not Disturb, I'd like my program to read my focus state and then let people reaching out know that I am currently unavailable. I also wanted to make the responses fun so I've included a the EmojiPasta package to make the responses ✨pretty✨. Turns out that your do not disturb state is stored in a json file in `~/Library/DoNotDisturb/DB/Assertsions.json` so it can be grabbed with the following code:
```python
def get_focus_mode() -> str:
    try:
        with open(DND_STATE_PATH, 'r') as dnd_state_file, open(DND_READABLE_PATH, 'r') as dnd_readable_file:
            dnd_state = json.load(dnd_state_file)
            modeid = dnd_state['data'][0]['storeAssertionRecords'][0]['assertionDetails']['assertionDetailsModeIdentifier']
            config = json.load(dnd_readable_file)
            focus = config['data'][0]['modeConfigurations'][modeid]['mode']['name']
            return focus
    except:
        return ''

```

adding to our main loop gives:


```python
def main():
    logging.debug(f'starting autoresponder with {config=}')
    fd = fetch_data.FetchData()
    emoji_generator = EmojipastaGenerator.of_default_mappings()

    while True:
        focus_mode = get_focus_mode()

        if config.only_respond_during_focus_mode and not focus_mode:
            logging.debug(f'focus mode is off, skipping...')
            time.sleep(config.delay_between_loops)
            continue

        logging.debug(f'starting loop: ')
        
        start_time = time.strftime('%Y-%m-%d %H:%M:%S',time.localtime(time.time() - config.delay_between_loops))
        msgs = fd.get_messages_between_dates(date_start = start_time)
        if not msgs:
            logging.debug(f'\tno messages found')
        
        for msg in msgs:

            logging.debug(f'\tchecking message: {msg.text}')
            if msg.is_from_me == 1:
                logging.debug(f'\t\tis from me, skipping...')
                continue

            gpt_prompt = f'You\'re being used as an autoresponder for Silas. Currently he is in {focus_mode} mode so he\'s not seeing the message and need you to generate the response for him. Please use the message history to tailor a custom response. Include a fun fact based on text history. Also inform the recipient what focous mode he is in. Try to continue the conversation by engaging with them. The message history is below:\n\n'
            message_history = fd.get_messages_from(msg.user_id)
            message_history_str = 'Message History:\n'
            for i, text in enumerate(message_history):
                if i > 10:
                    break
                content = text.text
                direction = 'me' if text.is_from_me == 1 else 'friend'
                message_history_str += f'{direction}: {content}\n'

            gpt_prompt += message_history_str
            gpt_prompt += f'\n\nMessage to respond to:\n{msg.text}'

            
            resp = generate_response(gpt_prompt)
            if config.emoji_pasta:
                resp = emoji_generator.generate_emojipasta(resp)
            logging.debug(f'\tResponse Generated: {resp}')
            
            # this is the line that's broken, 
            # need to figure out how to get the proper response
            # currently this wont respond to group chats. 
            # if you wanted to respond to a group chat, you'd need this format. 
            # imessage.send([num1, num2, num3], resp)
            imessage.send([msg.user_id], resp)

        logging.debug(f'\tsleeping for {config.delay_between_loops} seconds...')
        time.sleep(config.delay_between_loops)

if __name__ == "__main__":
    main()

```
and viola - project DONE.

![[emoji_pasta.jpg]]


check out the github repo! [https://github.com/SilasStokes/pymessage_gpt_bot](https://github.com/SilasStokes/pymessage_gpt_bot)

I have a few more features planned for it. I want to be able to associate the phone number in the messages table with a contact in iCloud. 