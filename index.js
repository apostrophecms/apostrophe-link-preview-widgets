const request = require('request-promise');
const cheerio = require('cheerio');
const _ = require('lodash');
const qs = require('qs');

module.exports = {
  extend: 'apostrophe-widgets',
  label: 'Link Previews',
  addFields: [
    {
      name: 'urlType',
      label: 'URL Type',
      help: 'Choose individual if curating your own tiles',
      type: 'select',
      choices: [
        { label: 'Individual Site', value: 'individual', showFields: ['individualUrl'] },
        { label: 'Apostrophe Headless Index', value: 'headless', showFields: ['headlessUrl', 'headlessFilterBy', 'headlessLimit'] }
      ]
    },
    {
      name: 'individualUrl',
      label: 'URL',
      type: 'url'
    },
    {
      name: 'headlessUrl',
      label: 'URL',
      type: 'url'
    },
    {
      name: 'headlessLimit',
      label: 'Preview Limit',
      help: 'Optional',
      type: 'integer'
    },
    {
      name: 'headlessFilterBy',
      label: 'Filter Results by',
      type: 'select',
      choices: [
        { label: 'Nothing', value: 'none' },
        { label: 'Tag', value: 'tag', showFields: ['headlessFilterByTag'] },
        { label: 'Join', value: 'join', showFields: ['headlessFilterByJoinName', 'headlessFilterByJoinValue'] }
      ]
    },
    {
      name: 'headlessFilterByTag',
      label: 'Tag to Filter by',
      type: 'string'
    },
    {
      name: 'headlessFilterByJoinName',
      label: 'Name of Join Field',
      type: 'string'
    },
    {
      name: 'headlessFilterByJoinSlug',
      label: 'Slug of Join',
      type: 'string'
    }
  ],

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
        return self.apos.utils.error(e);
      }
    });

    // pull all cached material for processing
    self.getCaches = async function (urls) {
      try {
        let caches = [];
        const previewCache = self.apos.caches.get('apostrophe-link-previews');
        await Promise.all(urls.map(async url => {
          caches.push({
            url: url,
            cache: await previewCache.get(url)
          });
        }));
        return caches;
      } catch (e) {
        console.log('e in getCaches');
        return self.apos.utils.error(e);
      }
    };

    // if a URL has a cache, pass it along
    // if not, fetch it, parse it, pass it along, and write it to the cache
    self.getData = async function (caches) {
      try {
        const data = [];
        const previewCache = self.apos.caches.get('apostrophe-link-previews');
        await Promise.all(caches.map(async cache => {
          if (cache.cache) {
            console.log('pulling from the cache');

            data.push(cache.cache);
          } else {
            let response = await request({
              uri: encodeURI(cache.url)
            });

            let scrapedData = await self.scrapeData(response);

            previewCache.set(encodeURI(cache.url), scrapedData, 86400);
            data.push(scrapedData);
          }
        }));
        return data;
      } catch (e) {
        console.log('e in getData');
        return self.apos.utils.error(e);
      }
    };

    // normalize all preview requests as an array of URLs for simple processing
    self.formatUrls = async function (data) {
      try {
        let urls;
        if (data.urlType === 'headless') {
          let query = {};
          if (data.headlessFilterByTag && data.headlessFilterBy === 'tag') {
            query.tag = data.headlessFilterByTag;
            // data.headlessUrl += '?tag=' + data.headlessFilterByTag;
          }
          if (data.headlessFilterByJoinName && data.headlessFilterByJoinSlug && data.headlessFilterBy === 'join') {
            console.log('am i in here?');

            query[data.headlessFilterByJoinName] = data.headlessFilterByJoinSlug;
            // data.headlessUrl += '?' + data.headlessFilterByJoinName + '=' + data.headlessFilterByJoinSlug;
          }
          if (data.headlessLimit) {
            query.perPage = data.headlessLimit;
          }

          console.log(query);

          // data.headlessUrl += '?' + qs.stringify(query);

          console.log(data.headlessUrl);
          console.log(qs.stringify(query));
          console.log(encodeURI(data.headlessUrl));

          let headlessResponse = await request({
            url: encodeURI(data.headlessUrl),
            json: true,
            qs: query
          });

          console.log(headlessResponse.results.length);

          urls = _.map(headlessResponse.results, '_url');

          console.log(urls);

          // if (data.headlessLimit) {
          //   urls = urls.slice(0, data.headlessLimit);
          // }
        } else {
          urls = [ data.individualUrl ];
        }
        return urls;
      } catch (e) {
        console.log('e in formatUrls');
        return self.apos.utils.error(e);
      }
    };

    self.scrapeData = async function (body) {
      try {
        const data = {};
        const $ = cheerio.load(body);
        self.scrapers.forEach(function (scraper) {
          data[scraper.name] = scraper.scraper($, body);
        });
        return data;
      } catch (e) {
        console.log('e in scrapeData');
        return self.apos.utils.error(e);
      }
    };

    self.pushAsset('stylesheet', 'always', {
      when: 'always'
    });
  }
};
