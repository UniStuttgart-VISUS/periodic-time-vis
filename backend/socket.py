from json import JSONDecodeError
import flask
from flask_sock import Sock
from simple_websocket import ConnectionClosed
import numpy as np
import json
from datetime import timedelta
import werkzeug.exceptions
import logging
import sys

from .dataset import Dataset
from .dataset_discovery import datasets


blueprint = flask.Blueprint('socket', __name__, template_folder=None, static_folder=None)
sockets = Sock(blueprint)

_logger = logging.getLogger(vars(sys.modules[__name__])['__package__'])

class SocketLoggerAdapter(logging.LoggerAdapter):
    def process(self, msg, kwargs):
        return '[%s] %s' % (self.extra['socket_id'], msg), kwargs



logger_id = 1
def _create_socket_logger():
    global logger_id
    l = SocketLoggerAdapter(_logger, dict(socket_id=F'sock-{logger_id}'))
    logger_id += 1

    return l


@sockets.route('/dataset/<string:dataset_id>')
def get_dataset_with_socket(socket, dataset_id):
    if dataset_id not in datasets:
        _logger.error('No such dataset: %s', dataset_id)
        socket.close()
        return

    logger = _create_socket_logger()
    definition = datasets[dataset_id]
    run_args = definition.run_function_args or dict()
    data = definition.run_function(filename=definition.file, **run_args)
    sockname = F'{socket.environ["SERVER_NAME"]}:{socket.environ["SERVER_PORT"]}{socket.environ["RAW_URI"]} -> {socket.environ["REMOTE_ADDR"]}:{socket.environ["REMOTE_PORT"]}'
    logger.info('Initialized dataset %s for socket "%s"', dataset_id, sockname)

    gen_args = definition.dataset_generation_args or dict()
    handle_dataset(socket, data, logger, **gen_args)


@sockets.route('/dataset/')
def upload_dataset(socket):
    logger = _create_socket_logger()

    # first, receive dataset
    try:
        message = socket.receive()
        if type(message) != bytes:
            logger.error('Did not receive correct data')
            socket.close()
            return

        message_type = np.frombuffer(message, dtype='<u4', count=1, offset=0)[0]
        if message_type != 2:
            logger.error('Incorrect initial message type: %d', message_type)
            socket.close()
            return

        try:
            length = np.frombuffer(message, dtype='<u4', count=1, offset=4)[0]
            xs = np.frombuffer(message, dtype='<f4', count=length, offset=8)
            ys = np.frombuffer(message, dtype='<f4', count=length, offset=8 + 4*length)
            values = np.frombuffer(message, dtype='<f4', count=length, offset=8 + 8*length)
            ts = np.frombuffer(message, dtype='<u4', count=length, offset=8 + 12*length)

        except ValueError as err:
            logger.error('Malformatted dataset: %s', err)
            socket.close()
            return

        data = [ dict(x=xs[i], y=ys[i], time=ts[i], value=values[i]) for i in range(length) ]
        sockname = F'{socket.environ["SERVER_NAME"]}:{socket.environ["SERVER_PORT"]}{socket.environ["RAW_URI"]} -> {socket.environ["REMOTE_ADDR"]}:{socket.environ["REMOTE_PORT"]}'
        logger.info('Received dataset of length %d for socket "%s"', length, sockname)

        handle_dataset(socket, data, logger)

    except ConnectionClosed:
        logger.info('Closed socket')
        socket.close()


def handle_dataset(socket, data, logger, minutes=5, num_bins=25, scaling=1):
    dataset = Dataset(data, timedelta(minutes=minutes).total_seconds(), num_bins, logger, scaling)

    try:
        while socket.connected:
            message = socket.receive()
            handle_message(dataset, message, socket, logger)
    except ConnectionClosed:
        logger.info('Closed socket')
        socket.close()


def handle_message(dataset, message, socket, logger):
    try:
        j = json.loads(message)
        msgtype = j.get('type', None)
        if msgtype == 'ready':
            logger.info('Sending data to socket')

            try:
                b = dataset.to_websocket_bytestring()
                socket.send(b)
            except:
                logger.error('Something went wrong')  # TODO
                errmsg = np.zeros(1, dtype='<u4')
                errmsg[0] = 100  # message type 100: error
                socket.send(errmsg.tobytes())

        elif msgtype == 'request additional data':
            periods = j.get('periods', None)
            if periods is None or not type(periods) == list or len(periods) == 0:
                logger.error('Additional data requested, but no valid periods passed: %s', periods)
                return

            requestId = j.get('requestId', None)
            if requestId is None or type(requestId) is not int:
                logger.error('Invalid requestId: %s', requestId)
                return

            logger.info('Calculating %d additional periods', len(periods))
            try:
                b = dataset.calculate_additional_websocket_data(periods, requestId)
                socket.send(b)
            except:
                logger.error('Something went wrong')  # TODO
                errmsg = np.zeros(1, dtype='<u4')
                errmsg[0] = 2  # message type 2: error
                socket.send(errmsg.tobytes())

        elif msgtype == 'set display attribute':
            attribute = j.get('attribute', None)
            if attribute is None:
                logger.error('Set display attribute requested, but no valid attribute set')
                errmsg = np.zeros(1, dtype='<u4')
                errmsg[0] = 2  # message type 2: error
                socket.send(errmsg.tobytes())
                return

            dataset.change_attribute_type(attribute)
            b = dataset.to_websocket_bytestring(message_type = 3)  # replace dataset
            socket.send(b)

        else:
            logger.error('unknown message type: %s', msgtype)

            errmsg = np.zeros(1, dtype='<u4')
            errmsg[0] = 100  # message type 100: error
            socket.send(errmsg.tobytes())

    except JSONDecodeError:
        logger.error('message was not a JSON object')

