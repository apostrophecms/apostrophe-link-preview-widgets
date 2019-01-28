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
        const urls = await self.formatUrls(req.body.data);
        const caches = await self.getCaches(urls);
        const data = await self.getData(caches);
        const body = self.renderer('widgetAjax', { previews: data })(req);
        return res.send({
          body: body,
          status: 'ok',
          data: data
        });
      } catch (e) {
        self.apos.utils.error(e);

        const body = self.renderer('widgetAjax', {
          status: 'error',
          message: e.response.statusCode + ': ' + e.options.uri + ', ' + e.response.statusMessage
        })(req);
        return res.send({
          body: body,
          status: 'error',
          message: e.response.statusCode + ': ' + e.options.uri + ', ' + e.response.statusMessage
        });
      }
    });

    // pull all cached material for processing
    self.getCaches = async function (urls) {
      let caches = [];
      const previewCache = self.apos.caches.get('apostrophe-link-previews');
      for (let url of urls) {
        caches.push({
          url: url,
          cache: await previewCache.get(url)
        });
      }
      return caches;
    };

    // if a URL has a cache, pass it along
    // if not, fetch it, parse it, pass it along, and write it to the cache
    self.getData = async function (caches) {
      const data = [];
      const previewCache = self.apos.caches.get('apostrophe-link-previews');
      for (let cache of caches) {
        if (cache.cache) {
          data.push(cache.cache);
        } else {
          let response = await request({
            uri: cache.url
          });
          let scrapedData = await self.scrapeData(response);
          await previewCache.set(cache.url, scrapedData, 86400);
          data.push(scrapedData);
        }
      }
      return data;
    };

    // normalize all preview requests as an array of URLs for simple processing
    // note this was more useful when running through an array of headless urls but we still might want to hit
    // more than one at a time at some point?
    self.formatUrls = async function (data) {
      let urls = [ encodeURI(data.individualUrl) ];
      return urls;
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
