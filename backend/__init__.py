import flask
import logging
import sys

logging.basicConfig(format='%(asctime)s [%(levelname)s]  %(message)s', datefmt='%Y-%m-%dT%H:%M:%S')
logger = logging.getLogger(vars(sys.modules[__name__])['__package__'])
logger.setLevel(logging.INFO)

app = flask.Flask(__name__, static_folder='../dist/', static_url_path='')
app.config['SOCK_SERVER_OPTIONS'] = {'ping_interval': 25}

from . import socket as sock
app.register_blueprint(sock.blueprint)

from . import dataset_discovery
app.register_blueprint(dataset_discovery.blueprint)

@app.route('/')
def root():
    return app.send_static_file('backend.html')

