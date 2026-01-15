---
title: remove sponsored ig posts
description: TODO
draft: false
date: 2023-06-28
tags:
  - project
---
I try really hard to stay off of social media. I am always trying to come up with new ways to beat my brain lusting for the sweet sweet algorithm that gives me short form content made of pure dopamine. Recently I found out that there's actually a web-ui for instagram and so one `rm -rf instagram` on my iPhone later I had significantly cut down on my screen time. Mission success. In classic 'But wait! There's more!' fashion, I realized I could probably use a browser extension to block some of the more addicting features ig has so I looked into it and came across the chrome extension, [antigram](https://chrome.google.com/webstore/detail/antigram-explore-blocker/igbheapdmolhhmmklmkfjjjncmhihfjh). I usually use safari so the idea of sequestering my bad habits to chrome made a lot of sense.

One install later, I am happily glancing at my feed when I notice this:
![[ig-sponsored-post.png]]

No no no. Cannot have that. Antigram unfortunately doesn't not have the ability to turn off sponsored posts BUT it does have a public github repo...

I pulled the repo to my computer, it's comprised of typescript and react, *nice*. Fortunately I already was familiar with basic workflow of extensions from a failed project where I tried to make a facebook marketplace chatbot that would lowball sellers. Trying to build the project with `npm install && npm run build` gave me me an error:
```sh
antigram-extension git:develop*  
❯ npm run build

> antigram-extension@1.0.0 build
> tsc && node scripts/build.js

node:internal/process/promises:289
            triggerUncaughtException(err, true /* fromPromise */);
            ^

[Error: ENOENT: no such file or directory, lstat 'build'] {
  errno: -2,
  code: 'ENOENT',
  syscall: 'lstat',
  path: 'build'
}

Node.js v19.5.0
```

Honestly I was pretty psyched that it error'd, now I am contributing in ways beyond my self serving blocking sponsored posts reason. I added the necessary `await fs.mkdirp("build");` to `scripts/build.js` and added a commit. 

Now time to figure out how to remove the posts. From my inspection of webpage using the chrome dev tools I noticed that every post is in the DOM as an article tag, and the only thing differentiating the Sponsored posts is the fact that they say "Sponsored" in their banner. Okay easy enough. Looking through the `content.ts` script, in order to get rid of the reels, stories, and feed they call a `hideElement()` function which sets the `style` property on the image to `none`. As a first draft I whipped up this monstrosity:

```js
const articles = document.querySelectorAll("article[role='presentation']") as NodeListOf<HTMLElement>;
if (articles) {
    articles.forEach(el => {
        const spans = Array.from(el.querySelectorAll("span") as NodeListOf<HTMLElement>);
        spans.forEach(span => {
        if (span.textContent === "Sponsored") {
            hideElement(el, true); // this is their function that sets el.style.display = "none"
        }
        });
    });
}
```

Which hid the Sponsored post but also made the feed glitch like crazy after you scrolled past it??? dangit. Going to have to do some testing. Luckily (?) with css there's an infinite amount of ways to accomplish things, each with their own caveats. Instead of setting the display style, I tried the `visibility` property with `el.style.visibility = "hidden"`. This didn't glitch the feed but now there's a huge gap on the page where the post should be which is less than ideal. I kept iterating on this, I actually spent about 2 hours (why did i spend so long messing with it? I don't know) playing with different css properties trying to find one that would give the best user experience. Culminating in this monstrosity:

```js
    const currentHeight = element.offsetHeight;
    const currentWidth = element.offsetWidth;

    // Clear inner HTML
    element.innerHTML = '<p style="display: flex; justify-content: center; align-items: center;">Sponsored Post removed</p>';

    // Set new content
    element.setAttribute('style', `
        height: ${currentHeight} !important;
        width: ${currentWidth} !important;
        min-height: ${currentHeight} !important;
        min-width: ${currentWidth} !important;
        display: block !important;
        box-sizing: border-box !important;
        line-height: ${currentHeight} !important;
    )
```

which worked surprisingly well but I thought was a bit overkill. The `!important` keyword was new to me, I had to use it because the browser wasn't respecting the height and width I set on the element. 

I wanted my solution to be as simple as the one in the repo so I ended up writing this function:

```js
export const hidePosts = (elements: HTMLElement[] | null, value: boolean | string) => {
  elements?.forEach(element => {
    const firstChild = element.firstChild as HTMLElement
    firstChild.style.display = value ? "none" : "block";
  });
};
```

which collapses the post and doesn't glitch the feed. 

Then I want back and cleaned up my attrocious for loop from before, extracting it to it's own function in `selectors.ts`. 

```js
export const sponsoredPosts = (): HTMLElement[] => {
  return Array.from(document.querySelectorAll<HTMLElement>("article[role='presentation']")).filter(article =>
    Array.from(article.querySelectorAll("span")).some(span => span.textContent === "Sponsored")
  );
};
```

Done. Now there is no more sponsored posts in my feed. I made a [pull request on the repo](https://github.com/aymyo/antigram-extension/pull/39) and I hope they use it!

As always, work begets work. While doing this project I noticed that the implementation of when their `content.ts` script is called, set in the `manifest.json` to run at `document_idle`, lets the sponsored posts load (become visible on screen) and then removes them a second later, which is not ideal. I also noticed that in the chrome store reviews, the #1 causer of bad reviews is that it still allows insta to suggest posts. Perhaps that will be my next project.

