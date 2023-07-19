import logging
import random
import sys
import uuid
import math
from datetime import datetime

logger = logging.getLogger(vars(sys.modules[__name__])['__package__'])


_domain_x = (0, 100)
_domain_y = (0, 100)
_domain_t = (datetime(2020, 5, 1), datetime(2020, 5, 27))
_domain_tn = (
        _domain_t[0].timestamp() / 86400,
        _domain_t[1].timestamp() / 86400,
        )

_cx = 31
_cy = 63
_r = 17.4
_r2 = _r ** 2

def _to_time(num):
    return num * 86400

def _random_time(period, phase):
    num_periods = math.ceil((_domain_tn[1] - _domain_tn[0]) / period)
    period_number = random.randint(-1, num_periods)

    time = _domain_tn[0] + period_number * period + phase
    if time < _domain_tn[0] or time > _domain_tn[1]:
        return _random_time(period, phase)

    return _to_time(time)

def random_point():
    x = random.uniform(*_domain_x)
    y = random.uniform(*_domain_y)
    delta = (x - _cx)**2 + (y - _cy)**2
    if delta < _r2:
        time = _random_time(45 / (24 * 60), 0)
    else:
        time = _random_time(5 / 24, 1 / 24)

    difference_from_noon = abs((time - 43200) % 86400) / 43200
    diff = difference_from_noon * difference_from_noon
    if delta < _r2:
        value = 2
    else:
        value = random.gauss(8, diff)

    return dict(id=str(uuid.uuid1()),
            x=x,
            y=y,
            time=time,
            value=value,
            )


def _run(number: int, filename=None):
    logger.info('Creating %d data points at random.', number)

    random.seed(123456)

    datapoints = []
    for _ in range(number):
        datapoints.append(random_point())

    return datapoints
