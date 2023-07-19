import logging
import random
import sys
import uuid
import math
from datetime import datetime, timezone

logger = logging.getLogger(vars(sys.modules[__name__])['__package__'])

_domain_x = (0, 100)
_domain_y = (0, 100)
_domain_t = (datetime(2011, 1, 1), datetime(2020, 12, 31))
_domain_tn = (
        _domain_t[0].timestamp() / 86400,
        _domain_t[1].timestamp() / 86400,
        )

_cx = 129
_cy = -40
_r = 120
_r2 = _r ** 2

def _to_time(num):
    return num * 86400

def _random_monthyear(startyear, endyear, startmonth, endmonth):
    while True:
        yield random.randint(startyear * 12 + startmonth - 1, endyear * 12 + endmonth - 1)

def _random_time():
    dom = random.randint(1, 6)

    monthyear = next(filter(lambda my: my % 3 == 2, _random_monthyear(2011, 2020, 1, 12)))

    month = monthyear % 12 + 1
    year = monthyear // 12

    hour = random.randint(0, 23)
    minute = random.randint(0, 59)
    second = random.randint(0, 59)

    return datetime(year, month, dom, hour, minute, second, tzinfo=timezone.utc).timestamp()


def random_point(index, length):
    num_xy = math.ceil(math.sqrt(length))

    ix = index % num_xy
    iy = index // num_xy

    x = _domain_x[0] + ix / (num_xy - 1) * (_domain_x[1] - _domain_x[0])
    y = _domain_y[0] + iy / (num_xy - 1) * (_domain_y[1] - _domain_y[0])

    delta = (x - _cx)**2 + (y - _cy)**2
    delta2 = abs(math.sqrt(delta) - _r)
    if delta2 < 10:
        time = _random_time()
    else:
        time = _to_time(random.uniform(*_domain_tn))

    return dict(id=str(uuid.uuid1()),
            x=x,
            y=y,
            time=time,
            value=0,  # XXX
            )


def _run(number: int, filename=None):
    logger.info('Creating %d data points at random.', number)

    random.seed(123456)

    datapoints = []
    for i in range(number):
        datapoints.append(random_point(i, number))

    return datapoints
