import logging
import sys
from datetime import timedelta
import math
import sys
from base64 import b64encode
import json
import logging
from scipy.stats import entropy
from scipy.signal import vectorstrength
import numpy as np


logger = logging.getLogger(vars(sys.modules[__name__])['__package__'])


increments = [
    ('seconds', 1, 60),
    ('minutes', 1, 60),
    ('hours', 1, 24),
    ('days', 1, 365),
        ]

def _exponential_series(p0, p1, increment):
    p = p0
    while p <= p1:
        yield p
        p *= increment


def _time_series(p0, p1):
    for unit, v0, v1 in increments:
        for amount in range(v0, v1):
            kwargs = dict()
            kwargs[unit] = amount
            t = timedelta(**kwargs).total_seconds()

            if t >= p0 and t <= p1:
                yield t



def generate_periods(dt, min_period, increment=1.005):
    # first, generate series
    series = list(_exponential_series(min_period, dt, increment))

    # generate integer multiples of time units, put them in there
    times = list(_time_series(min_period, dt))

    series = sorted([*series, *times])

    return np.array(series, dtype='float')



class Dataset:
    def __init__(self, data, min_period, num_bins, logger, scaling):
        self.min_period = min_period
        self.num_bins = num_bins
        self.logger = logger

        self.method = 'count'

        self.scaling = scaling

        self.compress_data(data)
        self.precalculate_histograms()
        self.precalculate_binning()


    def compress_data(self, rawdata):
        self.logger.info('Compressing dataset')

        length = len(rawdata)
        xs = np.zeros(length, dtype='<f4')
        ys = np.zeros(length, dtype='<f4')
        values = np.zeros(length, dtype='<f4')
        ts = np.zeros(length, dtype='<i4')

        for i, v in enumerate(rawdata):
            xs[i] = v['x']
            ys[i] = v['y']
            values[i] = v['value']

            t = int(round(v['time']))
            ts[i] = t

        self.xs = xs
        self.ys = ys
        self.values = values
        self.ts = ts


    def precalculate_histograms(self):
        self.logger.info('Precalculating histograms')

        data_as_seconds = self.ts.copy()
        data_as_seconds.sort()

        t0 = data_as_seconds.min()
        t1 = data_as_seconds.max()
        dt = t1 - t0

        self.dt = dt
        self.t0 = t0
        self.t1 = t1

        self.periods = generate_periods(dt, self.min_period)
        self.logger.info('  Generated %d periods', len(self.periods))

        hists, ents, vecs = self.calculate_histograms_entropies(self.periods)

        self.hists = hists
        self.ents = ents
        self.vecs = vecs


    def calculate_histograms_entropies(self, periods):
        data_as_seconds = self.ts.copy()

        t0 = data_as_seconds.min()
        t1 = data_as_seconds.max()
        dt = t1 - t0

        hists = np.zeros((len(periods), self.num_bins))
        ents = np.zeros((len(periods),))
        vecs = np.zeros((len(periods),))

        self.logger.info('  Generating %d histograms:', len(hists))
        for i, period in enumerate(periods, 1):
            hist = self.calculate_histogram_for(t0, period, data_as_seconds)
            ent = entropy(hist, base=2)
            sum = np.sum(hist[np.isnan(hist) == False])
            if np.isnan(sum) or sum == 0:
                sum = 1

            hist = np.asfarray(hist) / sum
            vec, _ = vectorstrength(data_as_seconds - t0, period)

            hists[i-1, :] = hist
            ents[i-1] = ent
            vecs[i-1] = vec

            if i % 500 == 0:
                self.logger.info('    Generated %d/%d histograms', i, len(periods))

        self.logger.info('  Generated %d histograms', len(hists))

        return hists, ents, vecs


    def calculate_histogram_for(self, t0, period, data_as_seconds):
        if self.method == 'count':
            phases = np.remainder(data_as_seconds - t0, period) / period
            hist, _ = np.histogram(phases, bins=self.num_bins, range=(0, 1))
            return hist

        elif self.method == 'average value':
            phases = np.remainder(data_as_seconds - t0, period) / period
            bin_edges = np.histogram_bin_edges(phases, bins=self.num_bins, range=(0, 1))
            bin_idxs = np.digitize(phases, bin_edges)
            hist = np.zeros(self.num_bins)

            for i in range(1, self.num_bins + 1):
                hist[i-1] = self.values[bin_idxs == i].mean()

            return hist

        elif self.method == 'variance':
            phases = np.remainder(data_as_seconds - t0, period) / period
            bin_edges = np.histogram_bin_edges([], bins=self.num_bins, range=(0, 1))
            bin_idxs = np.digitize(phases, bin_edges)
            hist = np.zeros(self.num_bins)
            for i in range(1, self.num_bins + 1):
                hist[i-1] = self.values[bin_idxs == i].var()

            return hist


        else:
            self.logger.error('no such method: "%s"', self.method)


    def precalculate_binning(self):
        self.logger.info('Precalculating binning')

        # TODO: change method

        # XXX: take min_period as the bin size
        min_period = self.min_period
        num_bins = math.ceil(self.dt / min_period)
        bins, _ = np.histogram(self.ts - self.t0, bins=num_bins, range=(0, num_bins * min_period))
        bins = bins.astype('<f4') / max(np.max(bins), 1)

        self.binning = bins
        self.binning_bin_size = min_period


    def to_json(self, outfile):
        self.logger.info('Writing JSON to output %s', outfile.name)

        data = dict(
            dataCount=len(self.xs),
            periodCount=len(self.periods),
            numBins=self.num_bins,
            phaseDomain=[0,1],
            periodDomain=[self.min_period, int(self.dt)],
            temporalDomain=[int(self.t0), int(self.t1)],
            numBinningBins=len(self.binning),
            binningBinSize=self.binning_bin_size,
                )

        for arr, dtype, field in [
                (self.hists.flatten(), '<f4', 'histograms'),
                (self.ents, '<f4', 'entropies'),
                (self.periods, '<f4', 'periods'),
                (self.xs, '<f4', 'xs'),
                (self.ys, '<f4', 'ys'),
                (self.values, '<f4', 'values'),
                (self.ts, '<i4', 'ts'),
                (self.binning, '<f4', 'binning'),
                ]:
            le_bytes = arr.astype(dtype).tobytes()
            b64 = b64encode(le_bytes).decode()
            data[field] = b64

        json.dump(data, outfile)


    def to_websocket_bytestring(self, message_type = 0):
        b = b''

        # message type
        dataset_type = np.zeros(1, dtype='<u4')
        dataset_type[0] = message_type

        metadata = dict(
            dataCount=len(self.xs),
            periodCount=len(self.periods),
            numBins=self.num_bins,
            phaseDomain=[0,1],
            periodDomain=[self.min_period, int(self.dt)],
            temporalDomain=[int(self.t0), int(self.t1)],
            numBinningBins=len(self.binning),
            binningBinSize=self.binning_bin_size,
            temporalDomainScaling=self.scaling,
                )

        metadata_bytes = json.dumps(metadata).encode()
        metadata_length = len(metadata_bytes)

        # metadata size
        metadata_size = np.zeros(1, dtype='<u4')
        metadata_size[0] = metadata_length

        b += dataset_type.tobytes()
        b += metadata_size.tobytes()
        b += metadata_bytes

        # histograms
        b += self.hists.flatten().astype('<f4').tobytes()

        # entropies
        b += self.ents.astype('<f4').tobytes()

        # vectorstrengths
        b += self.vecs.astype('<f4').tobytes()

        # periods
        b += self.periods.astype('<f4').tobytes()

        # xs
        b += self.xs.astype('<f4').tobytes()

        # ys
        b += self.ys.astype('<f4').tobytes()

        # values
        b += self.values.astype('<f4').tobytes()

        # binning
        b += self.binning.astype('<f4').tobytes()

        # ts
        b += self.ts.astype('<u4').tobytes()

        return b


    def calculate_additional_websocket_data(self, periods, requestId):
        self.logger.info('Calculating data for %d additional periods (request ID %d)', len(periods), requestId)
        hists, ents, vecs = self.calculate_histograms_entropies(periods)

        b = b''

        # message type: 1
        dataset_type = np.zeros(1, dtype='<u4')
        dataset_type[0] = 1

        # requestId
        request_id = np.zeros(1, dtype='<u4')
        request_id[0] = requestId

        metadata = dict(
            periodCount=len(periods),
            periodDomain=[self.min_period, int(self.dt)],
                )

        metadata_bytes = json.dumps(metadata).encode()
        metadata_length = len(metadata_bytes)

        # metadata size
        metadata_size = np.zeros(1, dtype='<u4')
        metadata_size[0] = metadata_length

        b += dataset_type.tobytes()
        b += request_id.tobytes()
        b += metadata_size.tobytes()
        b += metadata_bytes

        # histograms
        b += hists.flatten().astype('<f4').tobytes()

        # entropies
        b += ents.astype('<f4').tobytes()

        # vectorstrengths
        b += vecs.astype('<f4').tobytes()

        # periods
        b += np.array(periods, dtype='<f4').tobytes()

        return b


    def change_attribute_type(self, method):
        self.method = method

        hists, ents, vecs = self.calculate_histograms_entropies(self.periods)

        self.hists = hists
        self.ents = ents
        self.vecs = vecs

        self.precalculate_binning()
