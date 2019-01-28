const request = require('request-promise');
const cheerio = require('cheerio');
const _ = require('lodash');

module.exports = {
  extend: 'apostrophe-widgets',
  label: 'Link Previews',
  addFields: [
    {
      name: 'individualUrl',
      help: 'The absolute URL of the page you want to preview',
      label: 'URL',
      type: 'url'
    }
  ],

  construct: function (self, options) {
    // Get default scrapers
    self.scrapers = require('./lib/scrapers');

    // Add project level scrapers
    if (self.options.addScrapers) {
      self.options.addScrapers.forEach(function (scraper) {
        if (_.isString(scraper.name) && _.isFunction(scraper.scraper)) {
          self.scrapers.push(scraper);
        } else {
          self.apos.utils.warn('Warning: An apostrophe-link-preview-widgets scraper was malformed. They should be formatted { name: "string", scraper: fn($, body) } ');
        }
      });
    }

    // Remove any unnecessary scrapers
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
        const url = encodeURI(req.body.data.individualUrl);
        // const urls = await self.formatUrls(req.body.data);
        const cache = await self.getCache(url);
        const data = await self.getData(cache);
        const body = self.renderer('widgetAjax', data)(req);
        return res.send({
          body: body,
          status: 'ok'
        });
      } catch (e) {
        self.apos.utils.error(e);

        const body = self.renderer('widgetAjax', {
          status: 'error',
          message: e.name + ': ' + e.message
        })(req);
        return res.send({
          body: body,
          status: 'error',
          message: e.name + ': ' + e.message
        });
      }
    });

    // pull all cached material for processing
    self.getCache = async function (url) {
      const previewCache = self.apos.caches.get('apostrophe-link-previews');
      let cache = {
        url: url,
        cache: await previewCache.get(url)
      };
      return cache;
    };

    // if a URL has a cache, pass it along
    // if not, fetch it, parse it, pass it along, and write it to the cache
    self.getData = async function (cache) {
      let data;
      if (cache.cache) {
        data = cache.cache;
      } else {
        const previewCache = self.apos.caches.get('apostrophe-link-previews');
        let response = await request({
          url: cache.url
        });
        data = await self.scrapeData(response);
        await previewCache.set(cache.url, data, 86400);
      }
      return data;
    };

    // Run response body through the array of scrapers
    // return the result as an object
    self.scrapeData = async function (body) {
      const data = {};
      const $ = cheerio.load(body);
      self.scrapers.forEach(function (scraper) {
        data[scraper.name] = scraper.scraper($, body);
      });
      return data;
    };

    self.pushAsset('stylesheet', 'always', {
      when: 'always'
    });
  }
};
