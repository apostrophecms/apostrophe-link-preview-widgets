apos.define('apostrophe-link-preview-widgets', {
  extend: 'apostrophe-widgets',
  construct: function (self, options) {
    self.play = function ($widget, data, options) {
      if (data.url) {
        self.api('load', {
          url: data.url
        }, function (data) {
          $widget.find('[data-apos-link-preview-target]').html(data.body);
        }, function (err) {
          if (err) {
            console.log(err);
          }
        });
      }
    };
  }
});
