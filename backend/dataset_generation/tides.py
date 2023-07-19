import logging
import sys
from csv import DictReader

logger = logging.getLogger(vars(sys.modules[__name__])['__package__'])


def _run(filename: str, specialization: str, time_scaling: float = 1.0):
    logger.info('Loading extreme tides (%s) dataset', specialization)

    with open(filename) as f:
        c = DictReader(f)
        data = []

        for d in c:
            data.append(dict(
                x=float(d['x']),
                y=float(d['y']),
                time=int(float(d['time']) * time_scaling),
                value=float(d['value']))
                        )

        return data
