const request = require('request-promise');
const cheerio = require('cheerio');
const _ = require('lodash');

module.exports = {
  extend: 'apostrophe-widgets',
  label: 'Link Previews',
  addFields: [{
    name: 'url',
    label: 'URL',
    type: 'url'
  }],

  construct: function (self, options) {
    // Get default scrapers
    self.scrapers = require('./lib/scrapers');

    // Set up our user options
    if (self.options.addScrapers) {
      self.options.addScrapers.forEach(function (scraper) {
        if (_.isString(scraper.name) && _.isFunction(scraper.scraper)) {
          self.scrapers.push(scraper);
        } else {
          self.apos.utils.warn('Warning: An apostrophe-link-preview-widgets scraper was malformed. They should be formatted { name: "string", scraper: fn($, body) } ');
        }
      });
    }

    if (self.options.removeScrapers) {
      self.scrapers = _.filter(self.scrapers, function (o) {
        if (!self.options.removeScrapers.includes(o.name)) {
          return o;
        }
      });
    }

    // Route that responds to requests from the front end
    self.route('post', 'load', async function (req, res) {
      try {
        return self.getPreview(req, res);
      } catch (e) {
        return self.apos.utils.error(e);
      }
    });

    // get the preview from cache or go fetch the new data
    self.getPreview = async function (req, res) {
      try {
        const previewCache = self.apos.caches.get('apostrophe-link-previews');
        const cacheData = await previewCache.get(req.body.url);

        if (cacheData) {
          return self.sendPreview(req, res, cacheData);
        } else {
          return self.requestData(req, res, previewCache);
        }
      } catch (e) {
        self.apos.utils.error(e);
        return e;
      }
    };

    // Function that requests the link we want to preview
    self.requestData = async function (req, res, cache) {
      try {
        // We did not have a cache for this URL
        let response = await request(req.body.url);
        const data = {};
        const $ = cheerio.load(response);

        self.scrapers.forEach(function (scraper) {
          data[scraper.name] = scraper.scraper($, response.body);
        });

        // Cache it for next time
        // Return the result of the scraping
        cache.set(req.body.url, data, 86400);
        return self.sendPreview(req, res, data);
      } catch (e) {
        self.apos.utils.error(e);
        return self.sendError(req, res, e);
      }
    };

    // Render template with preview data and send it back to the front end
    self.sendPreview = async function (req, res, data) {
      try {
        const body = self.renderer('widgetAjax', data)(req);
        return res.send({
          body: body,
          status: 'ok',
          data: data
        });
      } catch (e) {
        self.apos.utils.error(e);
        return e;
      }
    };

    // Send the error to the template
    self.sendError = async function (req, res, e) {
      const body = self.renderer('widgetAjax', e)(req);
      return res.send({
        body: body,
        status: 'error',
        error: e
      });
    };

    self.pushAsset('stylesheet', 'always', {
      when: 'always'
    });
  }
};
