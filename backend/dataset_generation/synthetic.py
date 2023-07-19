import logging
import random
import sys
import uuid
import math
from collections import namedtuple
from datetime import datetime

logger = logging.getLogger(vars(sys.modules[__name__])['__package__'])


_domain_x = (0, 100)
_domain_y = (0, 100)
_domain_t = (datetime(2000, 1, 1), datetime(2001, 1, 1))
_domain_tn = (
        _domain_t[0].timestamp() / 86400,
        _domain_t[1].timestamp() / 86400,
        )

def _to_time(num):
    return num * 86400

def _random_time(period, phase):
    num_periods = math.ceil((_domain_tn[1] - _domain_tn[0]) / period)
    period_number = random.randint(-1, num_periods)

    time = _domain_tn[0] + period_number * period + phase
    if time < _domain_tn[0] or time > _domain_tn[1]:
        return _random_time(period, phase)

    return _to_time(time)


def uniform(period, phase):
    return dict(id=str(uuid.uuid1()),
            x=random.uniform(*_domain_x),
            y=random.uniform(*_domain_y),
            time=_to_time(random.uniform(*_domain_tn)),
            value=0,  # XXX
            )


def spot(period, phase, x=0, y=0):
    delta = random.uniform(0, (_domain_x[1] - _domain_x[0]) / 12)
    angle = random.uniform(0, math.pi * 2)
    dx = math.cos(angle) * delta
    dy = math.sin(angle) * delta

    return dict(id=str(uuid.uuid1()),
            x=x + dx,
            y=y + dy,
            time=_random_time(period, phase),
            value=0,  # XXX
            )


def _spline(t, p0, p1, p2, p3):
    a = (1 - t)**3
    b = 3 * (t - 2*t**2 + t**3)
    c = 3 * (t**2 - t**3)
    d = t**3

    out = [0, 0]
    for i in (0, 1):
        out[i] = a * p0[i] + b * p1[i] + c * p2[i] + d * p3[i]

    return tuple(out)

def cubic_spline_segment(period, phase, p0=(0,0), p1=(0,1), p2=(1,0), p3=(1,1), spread=0.3):
    delta = random.uniform(0, spread)
    angle = random.uniform(0, math.pi * 2)
    dx = math.cos(angle) * delta
    dy = math.sin(angle) * delta

    t = random.uniform(0, 1)
    x, y = _spline(t, p0, p1, p2, p3)

    return dict(id=str(uuid.uuid1()),
            x=x + dx,
            y=y + dy,
            time=_random_time(period, phase),
            value=0,  # XXX
            )


RandomClass = namedtuple('RandomClass', 'func,period,phase,params,weight')
_data_weights = [
    RandomClass(uniform, None, None, dict(), 1),
    RandomClass(spot, 14, 2, dict(x=12, y=37), 0.08),
    RandomClass(spot, 7, 4.1, dict(x=47, y=81), 0.07),
    RandomClass(cubic_spline_segment, 3, 0, dict(p0=(30,20), p1=(80,15), p2=(50,50), p3=(90,65), spread=3), 0.2),
    RandomClass(cubic_spline_segment, 3, 0, dict(p0=(65,38), p1=(65,38), p2=(80,50), p3=(80,10), spread=4), 0.16),
        ]


def _run(number: int, filename = None):
    logger.info('Creating %d data points at random.', number)

    random.seed(123456)

    init = random.choices(_data_weights,
            weights=map(lambda d: d.weight, _data_weights),
            k=number)

    datapoints = []
    for i in init:
        datapoints.append(i.func(i.period, i.phase, **i.params))

    return datapoints
