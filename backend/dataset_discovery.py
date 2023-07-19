import os.path
import sys
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Callable
import flask

from .dataset_generation import synthetic, synthetic2, synthetic3, sunspots, tides

_logger = logging.getLogger(vars(sys.modules[__name__])['__package__'])


@dataclass(frozen=True)
class DatasetDefinition:
    '''Contains definitions for a dataset, which are used for discovery.'''

    # identifier of the dataset, must be unique
    key: str

    # display name for the dataset, should be unique
    title: str

    # description of the dataset
    description: Optional[str]

    # path to the source file for the dataset
    file: Optional[str]

    # function generating the dataset from the (optional) file
    run_function: Callable[..., List[Dict[str, Any]]]

    # optional arguments for the run function
    run_function_args: Optional[Dict[str, Any]]

    # optional arguments for the dataset generation function
    dataset_generation_args: Optional[Dict[str, Any]]


_dataset_definitions = [
    DatasetDefinition(
        key='synthetic',
        title='Synthetic',
        description='Synthetic dataset with spatio-temporal patterns.',
        file=None,
        run_function=synthetic._run,
        run_function_args=dict(number=1000),
        dataset_generation_args=None,
        ),
    DatasetDefinition(
        key='synthetic2',
        title='Synthetic 2',
        description='Synthetic dataset with spatio-temporal patterns.',
        file=None,
        run_function=synthetic2._run,
        run_function_args=dict(number=2000),
        dataset_generation_args=None,
        ),
    DatasetDefinition(
        key='synthetic3',
        title='Synthetic 3',
        description='Synthetic dataset with spatio-temporal patterns.',
        file=None,
        run_function=synthetic3._run,
        run_function_args=dict(number=2000),
        dataset_generation_args=None,
        ),
    DatasetDefinition(
        key='sunspots',
        title='Sunspots',
        description='Sunspot count dataset.',
        file='datasets/sunspots_us_daily.csv',
        run_function=sunspots._run,
        run_function_args=None,
        # minutes are days here, because of int32 overflow
        dataset_generation_args=dict(minutes=7, scaling=24 * 60,),
        ),
    DatasetDefinition(
        key='tides_us',
        title='US Tides',
        description='High-tide events in mainland US measuring stations.',
        file='datasets/tides_us.csv',
        run_function=tides._run,
        run_function_args=dict(specialization='US', time_scaling=1.0 / (24 * 60)),
        # minutes are days here, because of int32 overflow
        dataset_generation_args=dict(minutes=7, scaling=24 * 60,),
        ),
    DatasetDefinition(
        key='tides-honolulu',
        title='Tides (Honolulu)',
        description='High-tide events for Honolulu, HI measuring station.',
        file='datasets/tides_honolulu.csv',
        run_function=tides._run,
        run_function_args=dict(specialization='Honolulu'),
        # minutes are days here, because of int32 overflow
        dataset_generation_args=dict(minutes=7, scaling=24 * 60,),
        ),
        ]


datasets = dict()
_logger.info('Finding available datasets:')
for dd in _dataset_definitions:
    if dd.file is None or os.path.exists(dd.file):
        datasets[dd.key] = dd
        _logger.info('  Dataset "%s" available.', dd.title)
    else:
        _logger.info('  Dataset "%s" not available.', dd.title)


blueprint = flask.Blueprint('dataset-discovery', __name__, template_folder=None, static_folder=None)

@blueprint.get('/datasets')
def get_datasets():
    d = list()
    for v in datasets.values():
        d.append(dict(
            key=v.key,
            title=v.title,
            description=v.description,
            ))

    return flask.jsonify(d)
