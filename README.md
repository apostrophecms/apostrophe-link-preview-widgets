# apostrophe-link-preview-widgets

## Renders a preview of a URL based on extracted metadata

### Detail
`apostrophe-link-preview-widgets` lets you paste a link to an external URL and have scraped meta data returned to a template. You can customize that template and use it to display a preview of the external website within your Apostrophe site. All previews are AJAXed in after page load and the module leverages `apostrophe-caches` for fastest delivery.

## Scraping
By default, the widget scrapes the given website and returns an object of all `<meta>` key/values in the site's `<head>` as well as any information that is part of [http://schema.org](schema.org's) microdata spec.

### Example response object
Your template will recieve an object that could look like:
```js
{
  status: 'ok',
  body: '<div class="apos-link-preview-widgets"> ...', // HTML blob that replaces loading interface
  data: {
    metaTags: {
      ogDescription: 'It may be hard to imagine liking an airline enough to buy its old silverware and service carts, but at a monthly sale, lovers of Delta Air Lines snap up decommissioned items.',
      ogImage: 'https://static01.nyt.com/images/2019/01/06/travel/06delta-sale6/06delta-sale6-facebookJumbo.jpg',
      ogTitle: 'Stocking Up at an Airline’s Garage Sale',
      ogType: 'article',
      ogUrl: 'https://www.nytimes.com/2019/01/16/travel/stocking-up-at-an-airlines-garage-sale.html',
      twitterCard: 'summary_large_image',
      twitterImage: 'https://static01.nyt.com/images/2019/01/06/travel/06delta-sale6/06delta-sale6-videoSixteenByNineJumbo1600.jpg',
      twitterImageAlt: 'From left, Alex Lee and Anthony Segreto check out an old issue of the Delta Digest.',
      twitterTitle: 'Stocking Up at an Airline’s Garage Sale',
      twitterUrl: 'https://www.nytimes.com/2019/01/16/travel/stocking-up-at-an-airlines-gara'
    },
    'schema.org': [
      {
        name: "http://schema.org/NewsArticle"
        properties: {
          articleBody: 'ImageAviation enthusiast Bill McDaniel with two of the items he ...' // full article body
          articleSection: 'Travel',
          author: 'By Jackie Snow'
        }
      }
    ]
  }
}
```


## Adding your own scrapers
At project level configuration you can specifiy additional scraping methods to employ on the returned document.

```js
// ... in app.js / lib/modules/apostrophe-link-preview-widgets/index.js
'apostrophe-link-preview-widgets': {
  addScrapers: [
    {
      name: 'headings',
      // scraper function is passed a cheerio object ($) that can be traversed using jQuery syntax.
      // it also includes a text blob of the response (body) if you want to parse it another way.
      scraper: function ($, body) {
        const data = {
          h1: [],
          h2: []
        };
        $('h1').each(function () {
          data.h1.push($(this).text())
        });

        $('h2').each(function () {
          data.h2.push($(this).text())
        });

        return data;
      }
    }
  ]
}
```
Your `/views/indexAjax.html`'s `data` object would now include a property `headings` with corresponding `h1` and `h2` arrays with those text values

## Removing default scrapers
Not going to need schema.org data? Save yourself the parsing

```js
// ... in app.js / lib/modules/apostrophe-link-preview-widgets/index.js
'apostrophe-link-preview-widgets': {
  removeScrapers: ['schema.org']
}
```
