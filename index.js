const request = require('async-request');
const cheerio = require('cheerio');
const _ = require('lodash');
let scrapers = require('./lib/scrapers');

module.exports = {
  extend: 'apostrophe-widgets',
  label: 'Link Previews',
  addFields: [{
    name: 'url',
    label: 'URL',
    type: 'url'
  }],

  construct: function (self, options) {
    // Set up our user options
    if (self.options.addScrapers) {
      self.options.addScrapers.forEach(function (scraper) {
        if (_.isString(scraper.name) && _.isFunction(scraper.scraper)) {
          scrapers.push(scraper);
        } else {
          self.apos.utils.warn('Warning: An apostrophe-link-preview-widgets scraper was malformed. They should be formatted { name: "string", scraper: fn($, body) } ');
        }
      });
    }

    if (self.options.removeScrapers) {
      scrapers = _.filter(scrapers, function (o) {
        if (!self.options.removeScrapers.includes(o.name)) {
          return o;
        }
      });
    }

    // Route that responds to requests from the front end
    self.route('post', 'load', function (req, res) {
      const previewCache = self.apos.caches.get('apostrophe-link-previews');
      previewCache.get(req.body.url).then(function (data) {
        if (data) {
          return self.sendPreview(req, res, data);
        } else {
          self.requestUrl(req, res, previewCache);
        }
      });
    });

    // Function that requests the link we want to preview
    self.requestUrl = async function (req, res, cache) {
      try {
        // We did not have a cache for this URL
        let response = await request(req.body.url);
        const data = {};
        const $ = cheerio.load(response.body);

        scrapers.forEach(function (scraper) {
          data[scraper.name] = scraper.scraper($, response.body);
        });

        // Cache it for next time
        cache.set(req.body.url, data, 86400).then(function () {
          return self.sendPreview(req, res, data);
        });
      } catch (e) {
        throw new Error('Something went wrong');
      }
    };

    // Render template with preview data and send it back to the front end
    self.sendPreview = function (req, res, data) {
      const body = self.renderer('widgetAjax', data)(req);
      return res.send({
        body: body,
        status: 'ok',
        data: data
      });
    };

    self.pushAsset('stylesheet', 'always', {
      when: 'always'
    });
  }
};
