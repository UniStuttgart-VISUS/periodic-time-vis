import logging
import sys
from csv import DictReader

logger = logging.getLogger(vars(sys.modules[__name__])['__package__'])


def _run(filename: str):
    logger.info('Loading US sunspot dataset')

    with open(filename) as f:
        c = DictReader(f)
        data = []

        for d in c:
            data.append(dict(
                x=float(d['x']),
                y=float(d['y']),
                time=int(d['time']),
                value=int(d['value']),
                        ))

        return data
