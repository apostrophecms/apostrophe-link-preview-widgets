const microdata = require('node-microdata-scraper');
const _ = require('lodash');

// Scrapers objects are made up of a name and a scraper function
// the scraper function is given the cheerio'd version of the request's body
// and a text blob of the body
// these functions should return whatever structure is works for the content
// and come through in your template as { name: <returned structure> }

module.exports = [
  {
    name: 'metaTags',
    scraper: function ($, body) {
      const data = {};

      // blanket capture all meta tag values
      $('head').children('meta').each(function () {
        if (this.attribs && this.attribs.property) {
          data[_.camelCase(this.attribs.property)] = this.attribs.content;
        }
      });
      return data;
    }
  },
  {
    name: 'schema.org',
    scraper: function ($, body) {
      // // capture everything that falls within schema.org
      let data = JSON.parse(microdata.parse(body));

      data.forEach(function (item) {
        delete item.id;
      });

      return data;
    }
  }
];
