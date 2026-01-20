---
draft: false
date: 2026-01-20
title: trackie 2 - the plan
---
Okay. The Plan.

1. software
2. electrical
3. mechanical

is my intended execution path through this project to the MVP. 

## 1. software

I have identified two capacitive touch ic's that are small enough and contain the requisite features needed to put together this project. Only one vendor however sells a development board that matches the requirements for this project so that is what I am going to be starting with.

The software todo list is as follows:
1. Do ic bringup of the vendor dev kit. 
2. Get vendor dev kit presenting to computer as a pointing peripheral. Using probably using zephyr and the rp2040 to start.
3. Add another vendor dev kit and create a compositor so that the 2 dev kits act as one. Will be using both rp2040 i2c peripherals for this.
4. Address the Address Problem (capacitive touch ic's share a single I2C address so they need to be obfuscated from the i2c bus and addressed through another mechanism).
5. Update software so that N number of trackpads can be composited.

## 2. electrical

Will need to design a custom development board pcb with the IC used from the software. 

1. Design the "top" circuit which will consist of a connector, capacitive touch IC + passives and, the sensor array.
2. Design the "bottom" circuit which will consistent of the middle man that solves the "Address Problem".

## 3. mechanical

This is the part I have the least experience in. Instead of the todo list, I'll focus on the requirements:

1. Must house the electronics.
2. Must fit in existing common key switch foot print.
3. Must provide a nice keypress experience.


That is it for now. Will be following up with my individual todo lists.
