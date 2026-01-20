---
title: header pin switches
date: 2026-01-20
draft: false
tags:
  - project
---
At work I do an incredibly frustrating menial task about 3-5 times a day. I wrestle on, and then off, jumpers for header pins. 

These things:

![[generic_jumpers.png|300]]


Timing myself, tool-less it takes about 15 seconds to remove a jumper. If I arm myself with pliers or a small pry tool I can do it in 2-3 seconds. The problem primarily is that the jumpers in this context are colocated along their broad axis, making middle ones absolute cretins to the fingernail-less. The ones pictured are actually better than the ones I have because they have a lip on the end. 

I initially wanted to build an embedded KVM style solution. Where I have a serial connection to an MCU which can assert or de-assert the the header pin connection on demand. And I still might do that. But in the interest of making a share-able solution to other team members I wanted something I could just hand to people and they would know exactly how to use it. 

This is what I came up with:

![[finished_jumper_switches.jpeg|400]]

It now takes less than a second to assert/deassert any header pin and no special tool needed to get the middle ones out. 

All files are on github at: https://github.com/silasstokes/header_pins_to_switches_adapter