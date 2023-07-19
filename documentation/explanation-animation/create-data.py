#!/usr/bin/env python3

import numpy as np
import json
import math

num_periods = 11
num_total_bins = 11 * 13
num_events = 500
num_noise = 100
num_grouped_noise = 20
num_grouped_noise_groups = 5

rng = np.random.default_rng(seed=143831)
events = rng.normal(0.36, 0.05, num_events)

# random noise
events[:num_noise] = rng.random(num_noise)

# grouped noise
group_poss = rng.random(num_grouped_noise_groups)
for i, p in enumerate(group_poss):
    events[num_noise + i * num_grouped_noise:num_noise + (i+1) * num_grouped_noise] = rng.normal(p, 0.04, num_grouped_noise)

events += rng.choice(list(range(num_periods)), num_events)
events /= num_periods

binnings = dict()
for i in [11,12,13]:
    hist, _ = np.histogram(events, range=(0,1), bins=13 * i)
    b = [ float(h) for h in hist ]
    binnings[i] = b

binnings_fine = dict()
for i in range(-5, 6):
    rem = np.remainder(events, 1/13 * math.pow(1.005, i))
    rem *= 13
    hist, _ = np.histogram(rem, range=(0,1), bins=13)
    b = [ float(h) for h in hist ]
    binnings_fine[i] = b


jitter = rng.random(num_events)
delay = rng.random(num_events)

data = [ dict(t=t, jitter=j, delay=d) for t, j, d in zip(events, jitter, delay) ]
with open('assets/data.json', 'w') as f:
    json.dump(dict(events=data, binnings=binnings, binnings_fine=binnings_fine), f)
