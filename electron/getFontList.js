'use strict';
const os = require('os');

let font_list_module = null;
if(os.platform() === 'win32') {
  font_list_module = require('system-font-list-kr');
} else {
  font_list_module = require('font-list');
}

const getFontList = async () => {
  try {
    const fonts = await font_list_module.getFonts({disableQuoting: true});
    return fonts;
  } catch (err) {
    console.error(err);
  }
};

module.exports = { getFontList };