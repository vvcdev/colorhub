const express = require('express');
const nearestColor = require('nearest-color');
const colorNameList = require('color-name-list');
const bodyParser = require('body-parser');
const Color = require('color');
const crypto = require('node:crypto');
const fs = require('fs');
const axios = require('axios');
const sharp = require('sharp');
const request = require('request');
const device = require('express-device');
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));
let favoriteColors = [];
let ipLikes = {};
let sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

const colors = colorNameList.reduce((o, { name, hex }) => Object.assign(o, { [name]: hex }), {});
const nearest = nearestColor.from(colors);

function generateRandomColor() {
    const randomHexColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    return randomHexColor;
}

// Use the express-device middleware to detect the device type
app.use(device.capture());

// Define a middleware function to redirect specific devices
const redirectMobileTablet = (req, res, next) => {
  const isMobile = req.device.type === 'phone';
  const isTablet = req.device.type === 'tablet' || /iPad/i.test(req.get('user-agent'));

  // Redirect mobile and tablet (including iPad) devices to the mobile route
  if (isMobile || isTablet) {
    return res.redirect('/mobile');
  } else {
    next(); // Proceed to the next middleware or route for computers
  }
};


app.get('/random-color', (req, res) => {
    const randomHexColor = generateRandomColor();
    res.redirect(`/color/${encodeURIComponent(randomHexColor)}`);
});

app.get('/random-palette', (req, res) => {
  fs.readFile('./palettes.json', (err, data) => {
    if (err) throw err;
    let palettes = JSON.parse(data);
    let keys = Object.keys(palettes);
    let randomKey = keys[Math.floor(Math.random() * keys.length)];
    res.redirect('/palettes/' + randomKey);
  });
});

// Render the homepage
app.get('/', (req, res) => {
  const colorz = [
    '#ff0000', // Red
    '#00ff00', // Green
    '#0000ff', // Blue
    '#4b0082', // Indigo
    '#00ffff', // Cyan
    '#8b0000', // Dark Red
    '#ffd700', // Gold
    '#008000', // Dark Green
    '#ff7f00', // Orange
    '#000000', // Black
    '#800080', // Purple
    '#808080', // Gray
    '#ffffff', // White
    '#ff1493', // DeepPink
    '#008080', // Navy
    '#c0c0c0', // Silver
  ]; 
  res.render('index', { theme: 'black', colorz });
});


app.post('/search-color', (req, res) => {
  const { color } = req.body;
  if (color) {
    if (color.startsWith('#')) {
      res.redirect(`/color/${encodeURIComponent(color.toLowerCase())}`);
    } else if (color.toLowerCase().startsWith('rgb') || color.toLowerCase().startsWith('hsl')) {
      let colorObj = Color(color.toLowerCase());
      res.redirect(`/color/${encodeURIComponent(colorObj.hex())}`);
    } else {
      const colorNameQuery = color.toLowerCase();
      const matchingColorName = Object.keys(colors).find(colorName => {
        return colorName.toLowerCase() === colorNameQuery;
      });
      if (matchingColorName) {
        const colorHex = colors[matchingColorName];
        res.redirect(`/color/${encodeURIComponent(colorHex)}`);
      } else {
        res.render('index', { colorName: null, searchedColor: { name: 'Not found', hex: 'N/A' }, searchResults: null });
      }
    }
  } else {
    res.status(400).send('Invalid color search.');
  }
});
app.post('/search-palette', (req, res) => {
  const { palette } = req.body;
  if (palette) {
    const matchingPalettes = findMatchingPalettes(palette.toLowerCase());
    res.render('palettesSearchResults', { palettes: matchingPalettes, theme: 'black', palettesData });
  } else {
    res.status(400).send('Invalid palette search.');
  }
});

// Modify the findMatchingPalettes function to search by hex code
function findMatchingPalettes(paletteQuery) {
  const matchingPalettes = [];
  for (const [paletteId, palette] of Object.entries(palettesData)) {
    // Check if the palette name or any color in the palette matches the query
    if (
      palette.name.toLowerCase().includes(paletteQuery) ||
      palette.colors.some((color) => color.toLowerCase() === paletteQuery)
    ) {
      matchingPalettes.push({ id: paletteId, ...palette });
    }
  }
  return matchingPalettes;
}

// Function to convert CMYK to RGB
function cmykToRgb(cmykArray) {
  const [cValue, m, y, k] = cmykArray.map(n => n / 100);
  const r = 255 * (1 - cValue) * (1 - k);
  const g = 255 * (1 - m) * (1 - k);
  const b = 255 * (1 - y) * (1 - k);

  return [r,g,b];
}

app.get('/color/:colorCode', (req, res) => {
  const { colorCode } = req.params;
  const rgb = req.query.rgb ? req.query.rgb.split(',') : null;
  const hsv = req.query.hsv ? req.query.hsv.split(',') : null;
  const hsl = req.query.hsl ? req.query.hsl.split(',') : null;
  const cmyk = req.query.cmyk ? req.query.cmyk.split(',') : null;
  let colorObj;
  if (rgb && rgb.length === 3) {
    colorObj = Color.rgb(rgb.map(Number));
  } else if (hsv && hsv.length === 3) {
    colorObj = Color.hsv(hsv.map(Number));
  } else if (hsl && hsl.length === 3) {
    colorObj = Color.hsl(hsl.map(Number));
  } else if (cmyk && cmyk.length === 4) {
    const rgbFromCmyk = cmykToRgb(cmyk.map(Number));
    colorObj = Color.rgb(rgbFromCmyk);
  } else {
    colorObj = Color(colorCode);
  }

  const shades = generateShades(colorObj);
  const saturations = generateSaturations(colorObj);
  const hues = generateHues(colorObj);
  const complementaryColors = generateComplementaryColors(colorObj);
  const triadicColors = generateTriadicColors(colorObj);
  const alphaShades = generateAlphaShades(colorObj);
  const analogousColors = generateAnalogousColors(colorObj);
  const compoundColors = generateCompoundColors(colorObj);
  const tetradicColors = generateTetradicColors(colorObj);

  const closestColorName = nearest(colorObj.hex()).name;
  const colorData = {
    name: closestColorName,
    hex: colorObj.hex(),
    rgb: colorObj.rgb().array().map(value => Math.round(value)),
    hsv: colorObj.hsv().array().map((value, index) => (index === 1 || index === 2) ? Math.round(value) + '%' : Math.round(value)),
    hsl: colorObj.hsl().array().map((value, index) => (index === 1 || index === 2) ? Math.round(value) + '%' : Math.round(value)),
    cmyk: rgbToCmyk(colorObj.rgb().array()),
    shades,
    saturations,
    hues,
    complementaryColors,
    triadicColors,
    alphaShades,
    analogousColors,
    compoundColors,
    tetradicColors,
    likes: getLikes(colorObj.hex(), req.ip),
  };
  res.render('color', { colorData, theme: 'black', palettesData, Color, simulateColorBlindness });
});

function rgbToCmyk(rgb) {
  const [r, g, b] = rgb;
  if( r === 0 && g === 0 && b === 0 ) {
    return [0,0,0,100];
  }
  const k = Math.min(1 - r / 255, 1 - g / 255, 1 - b / 255);
  const c = ((1 - r / 255 - k) / (1 - k)) || 0;
  const m = ((1 - g / 255 - k) / (1 - k)) || 0;
  const y = ((1 - b / 255 - k) / (1 - k)) || 0;
  return [Math.round(c * 100), Math.round(m * 100), Math.round(y * 100), Math.round(k * 100)];
}

// Trending route
app.get('/trending', (req, res) => {
  const trendingColors = Object.entries(likesData)
    .map(([color, likes]) => ({ color, likes: likes.length }))
    .filter(colorData => colorData.likes > 1) // Filter colors with more than one like
    .sort((a, b) => b.likes - a.likes);

  res.render('trending', { trendingColors, theme: 'black' });
});

app.get('/color-suggestions', (req, res) => {
  const inputColorName = req.query.inputColorName.toLowerCase();
  const suggestions = Object.keys(colors).filter(colorName =>
    colorName.toLowerCase().includes(inputColorName)
  );
  const exactMatchIndex = suggestions.findIndex(suggestion => suggestion.toLowerCase() === inputColorName);
  if (exactMatchIndex > -1) {
    const exactMatch = suggestions[exactMatchIndex];
    suggestions.splice(exactMatchIndex, 1);
    suggestions.unshift(exactMatch);  
  }
  res.json({ suggestions });
});

app.get('/color-hex', (req, res) => {
  const colorName = req.query.colorName; 
  const colorHex = Object.keys(colors).find(key => key.toLowerCase() === colorName.toLowerCase());
  if (colorHex) {
    res.json({ hex: colors[colorHex]});
  } else {
    res.json({ hex: "N/A" });
  }
});


// Function to simulate color blindness
function simulateColorBlindness(colorObj, type) {
  // Extract color channels
  const r = colorObj.red();
  const g = colorObj.green();
  const b = colorObj.blue();

  // Simulate color blindness based on the type
  if (type === 'Protanopia') {
    const newR = 0.567 * r + 0.433 * g + 0.0 * b;
    const newG = 0.558 * r + 0.442 * g + 0.0 * b;
    const newB = 0.0 * r + 0.242 * g + 0.758 * b;
    return Color.rgb(newR, newG, newB);
  } else if (type === 'Deuteranopia') {
    const newR = 0.625 * r + 0.375 * g + 0.0 * b;
    const newG = 0.7 * r + 0.3 * g + 0.0 * b;
    const newB = 0.0 * r + 0.3 * g + 0.7 * b;
    return Color.rgb(newR, newG, newB);
  } else if (type === 'Tritanopia') {
    const newR = 0.95 * r + 0.05 * g + 0.0 * b;
    const newG = 0.0 * r + 0.433 * g + 0.567 * b;
    const newB = 0.0 * r + 0.475 * g + 0.525 * b;
    return Color.rgb(newR, newG, newB);
  } else if (type === 'Protanomaly') {
    const newR = 0.817 * r + 0.183 * g + 0.0 * b;
    const newG = 0.333 * r + 0.667 * g + 0.0 * b;
    const newB = 0.0 * r + 0.125 * g + 0.875 * b;
    return Color.rgb(newR, newG, newB);
  } else if (type === 'Deuteranomaly') {
    const newR = 0.8 * r + 0.2 * g + 0.0 * b;
    const newG = 0.258 * r + 0.742 * g + 0.0 * b;
    const newB = 0.0 * r + 0.142 * g + 0.858 * b;
    return Color.rgb(newR, newG, newB);
  } else if (type === 'Tritanomaly') {
    const newR = 0.966 * r + 0.034 * g + 0.0 * b;
    const newG = 0.0 * r + 0.733 * g + 0.267 * b;
    const newB = 0.0 * r + 0.183 * g + 0.817 * b;
    return Color.rgb(newR, newG, newB);
  } else if (type === 'Achromatopsia') {
    const newR = 0.299 * r + 0.587 * g + 0.114 * b;
    const newG = 0.299 * r + 0.587 * g + 0.114 * b;
    const newB = 0.299 * r + 0.587 * g + 0.114 * b;
    return Color.rgb(newR, newG, newB);
  } else if (type === 'Achromatomaly') {
    const newR = 0.618 * r + 0.320 * g + 0.062 * b;
    const newG = 0.163 * r + 0.775 * g + 0.062 * b;
    const newB = 0.163 * r + 0.320 * g + 0.516 * b;
    return Color.rgb(newR, newG, newB);
  }
}

function generateShades(baseColor) {
  const shades = [];
  const maxShades = 15;

  const baseLightness = baseColor.lightness(); // Get the base lightness
  const targetDarkness = 4; // Adjust this value to control the darkness level (lower is darker)

  for (let i = maxShades - 1; i >= 0; i--) { // Start from maxShades - 1 to reverse the order
    const darkenedLightness = baseLightness - i * ((baseLightness - targetDarkness) / (maxShades - 1)); // Calculate adjusted lightness
    const darkenedColor = baseColor.lightness(darkenedLightness);
    shades.push(darkenedColor.hex());
  }

  return shades;
}


function generateSaturations(baseColor) {
  const baseSaturation = baseColor.saturationl();
  const saturations = [];
  const steps = 15;

  // Calculate the position of the base color in the scheme
  const baseColorPosition = Math.min(Math.floor((baseSaturation / 100) * steps), steps - 1);

  for (let i = 0; i < steps; i++) {
    if (i !== baseColorPosition) {
      const saturationStep = i - baseColorPosition;
      const currentSaturation = baseSaturation + (saturationStep * (100 / steps));
      const saturation = baseColor.saturationl(currentSaturation).hex();
      saturations.push(saturation);
    }
  }

  saturations.splice(baseColorPosition, 0, baseColor.hex());

  return saturations;
}

function generateHues(baseColor) {
  const hues = [];
  const hueCount = 15;
  const angleIncrement = 360 / hueCount;

  // Adjust the rotation angle to place the base color in the middle
  const baseColorRotation = 180;

  // Generate hues around the color wheel
  for (let i = 0; i < hueCount; i++) {
    let hue;
    if (i === Math.floor(hueCount / 2)) {
      hue = baseColor.hex(); // Use the base color for the middle index
    } else {
      hue = baseColor.rotate(baseColorRotation + (i * angleIncrement)).hex();
    }
    hues.push(hue);
  }

  return hues;
}




// Generate complementary color and base color
function generateComplementaryColors(baseColor) {
  const complementaryHue = (baseColor.hue() + 180) % 360;
  const complementaryColor = Color({ h: complementaryHue, s: baseColor.saturationl(), l: baseColor.lightness() }).hex();
  return [baseColor.hex(), complementaryColor];
}


// Generate triadic colors based on the base color
function generateTriadicColors(baseColor) {
  const baseHue = baseColor.hue();
  const triadicHues = [(baseHue + 120) % 360, (baseHue + 240) % 360];
  const triadicColors = triadicHues.map(hue => Color({ h: hue, s: baseColor.saturationl(), l: baseColor.lightness() }).hex());
  return [baseColor.hex(), ...triadicColors];
}

function generateAlphaShades(baseColor) {
  const alphaShades = [];
  const maxShades = 12;

  const baseLightness = baseColor.lightness(); // Get the base lightness
  const maxLightness = 88; // Lightness of white

  for (let i = 0; i < maxShades; i++) {
    const lightness = baseLightness + i * ((maxLightness - baseLightness) / (maxShades - 1)); // Calculate adjusted lightness
    const tintedColor = baseColor.lightness(lightness);
    alphaShades.push(tintedColor.hex());
  }

  return alphaShades;
}

function generateAnalogousColors(baseColor) {
  const baseHue = baseColor.hue();
  const analogousHues = [(baseHue + 30) % 360, (baseHue - 30 + 360) % 360];
  const analogousColors = analogousHues.map(hue => Color({ h: hue, s: baseColor.saturationl(), l: baseColor.lightness() }).hex());
  return [baseColor.hex(), ...analogousColors];
}

function generateTetradicColors(baseColor) {
  const baseHue = baseColor.hue();
  const tetradicHues = [(baseHue + 90) % 360, (baseHue + 180) % 360, (baseHue + 270) % 360];
  const tetradicColors = tetradicHues.map(hue => Color({ h: hue, s: baseColor.saturationl(), l: baseColor.lightness() }).hex());
  return [baseColor.hex(), ...tetradicColors];
}

// Generate compound colors based on the base color
function generateCompoundColors(baseColor) {
  const baseHue = baseColor.hue();
  const compoundHues = [(baseHue + 150) % 360, (baseHue + 210) % 360];
  const compoundColors = compoundHues.map(hue => Color({ h: hue, s: baseColor.saturationl(), l: baseColor.lightness() }).hex());
  return [baseColor.hex(), ...compoundColors];
}


function getLikes(color, ip) {
  const colorLikes = likesData[color] || [];
  const ipLikes = colorLikes.filter((like) => like.ip === ip);
  return colorLikes.length - ipLikes.length;
}

// Handle color likes
app.post('/like/:colorCode', (req, res) => {
  const { colorCode } = req.params;
  const ip = sha256((req.headers['x-forwarded-for'].split(",")[0] || req.socket.remoteAddress));

  // Check if the color has already been liked by the IP
  const colorLikes = likesData[colorCode] || [];
  console.log(colorLikes, ip);
  const ipLikes = colorLikes.filter((like) => like === ip);
  if (ipLikes.length > 0) {
    // Decrease the like count and remove the like entry if it becomes zero
    colorLikes.splice(colorLikes.indexOf(ip), 1);
  } else {
    // Increase the like count and add the like entry
    colorLikes.push(ip);
  }

  // Update the likes data
  likesData[colorCode] = colorLikes;

  // Save the updated likes data to the file
  fs.writeFile('likes.json', JSON.stringify(likesData, null, 2), (error) => {
    if (error) {
      console.error('Error writing likes data:', error);
      res.status(500).json({ error: 'Failed to update likes data' });
    } else {
      // Prepare the response data
      const responseData = {
        likes: getLikes(colorCode, req.ip),
        isLiked: ipLikes.length === 0,
      };

      // Send the updated likes count and like status as JSON
      res.status(200).json(responseData);
    }
  });
});

// Load existing likes data from the file on server start
fs.readFile('likes.json', (error, data) => {
  if (!error) {
    try {
      likesData = JSON.parse(data);
    } catch (parseError) {
      console.error('Error parsing likes data:', parseError);
    }
  }
});

// Save likes data to the file on server exit
process.on('exit', () => {
  fs.writeFileSync('likes.json', JSON.stringify(likesData, null, 2));
});

let palettesData = {};
fs.readFile('palettes.json', (error, data) => {
  if (!error) {
    try {
      palettesData = JSON.parse(data);
    } catch (parseError) {
      console.error('Error parsing palettes data:', parseError);
    }
  }
});

// Helper function to generate a unique palette ID
function generateUniquePaletteId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Helper function to save palettes data to the file
function savePalettesDataToFile() {
  fs.writeFile('palettes.json', JSON.stringify(palettesData, null, 2), (error) => {
    if (error) {
      console.error('Error writing palettes data:', error);
    }
  });
}

// Render the palette creation page
app.get('/palettes', (req, res) => {
  res.render('palettes', { theme: 'black' });
});

app.post('/palettes/create', (req, res) => {
  const { paletteName, colors } = req.body;
  if (colors.length >= 3 && colors.length <= 5) { // Allow 3, 4, or 5 colors
    const paletteId = generateUniquePaletteId();
    palettesData[paletteId] = {
      name: paletteName,
      colors: colors,
    };
    savePalettesDataToFile();
    res.redirect(`/palettes/${paletteId}`);
  } else {
    res.json({ success: false, message: 'Please choose between 3 and 5 colors.' });
  }
});

// Render the individual color palette page
app.get('/palettes/:paletteId', (req, res) => {
  const { paletteId } = req.params;
  const palette = palettesData[paletteId];
  if (palette) {
    const similarPalettes = findSimilarPalettes(paletteId);
    res.render('palette', { palette, similarPalettes, theme: 'black' });
  } else {
    res.render('404', { theme: 'black', errorMessage: 'Palette not found' });
  }
});

function findSimilarPalettes(basePaletteId) {
  const basePaletteColors = palettesData[basePaletteId].colors;
  const similarPalettes = [];
  for (const [paletteId, palette] of Object.entries(palettesData)) {
    if (paletteId !== basePaletteId) {
      const commonColors = palette.colors.filter((color) => basePaletteColors.includes(color));
      if (commonColors.length > 0) {
        similarPalettes.push({ id: paletteId, ...palette });
      }
    }
  }
  return similarPalettes;
}

app.get('/c/%23:colorCode', (req, res) => {
  const { colorCode } = req.params;
  const colorObj = Color(`#${colorCode}`); // Assuming the colorCode is provided without the '#'

  // Generate the color image
  const image = sharp({
    create: {
      width: 200,
      height: 200,
      channels: 3,
      background: { r: colorObj.red(), g: colorObj.green(), b: colorObj.blue() }
    }
  });

  image.png().toBuffer((err, data, info) => {
    if (err) {
      res.status(500).send('Error generating color image');
    } else {
      res.set('Content-Type', 'image/png');
      res.send(data);
    }
  });
});

app.get('/drawing-room/%23:hexcode', (req, res) => {
  const hexcode = req.params.hexcode;
  const imageUrl = `https://www.color-name.com/interior?h=${hexcode}&w=drawing-room`;

  // Use the request library to fetch the image
  request(imageUrl)
    .on('error', (err) => {
      res.status(500).send('Error fetching the image');
    })
    .pipe(sharp().resize(300, 200)) // Resize the image to 300x200 using sharp
    .pipe(res); // Pipe the resized image directly to the response
});

app.get('/drawing-room/%23:hexcode', (req, res) => {
  const hexcode = req.params.hexcode;
  const imageUrl = `https://www.color-name.com/interior?h=${hexcode}&w=drawing-room`;

  // Use the request library to fetch the image
  request(imageUrl)
    .on('error', (err) => {
      res.status(500).send('Error fetching the image');
    })
    .pipe(sharp().resize(300, 200)) // Resize the image to 300x200 using sharp
    .pipe(res); // Pipe the resized image directly to the response
});

app.get('/bedroom/%23:hexcode', (req, res) => {
  const hexcode = req.params.hexcode;
  const imageUrl = `https://www.color-name.com/interior?h=${hexcode}&w=bedroom`;

  // Use the request library to fetch the image
  request(imageUrl)
    .on('error', (err) => {
      res.status(500).send('Error fetching the image');
    })
    .pipe(sharp().resize(300, 200)) // Resize the image to 300x200 using sharp
    .pipe(res); // Pipe the resized image directly to the response
});

app.get('/kitchen/%23:hexcode', (req, res) => {
  const hexcode = req.params.hexcode;
  const imageUrl = `https://www.color-name.com/interior?h=${hexcode}&w=kitchen`;

  // Use the request library to fetch the image
  request(imageUrl)
    .on('error', (err) => {
      res.status(500).send('Error fetching the image');
    })
    .pipe(sharp().resize(300, 200)) // Resize the image to 300x200 using sharp
    .pipe(res); // Pipe the resized image directly to the response
});

app.get('/living-room/%23:hexcode', (req, res) => {
  const hexcode = req.params.hexcode;
  const imageUrl = `https://www.color-name.com/interior?h=${hexcode}&w=living-room`;

  // Use the request library to fetch the image
  request(imageUrl)
    .on('error', (err) => {
      res.status(500).send('Error fetching the image');
    })
    .pipe(sharp().resize(300, 200)) // Resize the image to 300x200 using sharp
    .pipe(res); // Pipe the resized image directly to the response
});

app.get('/car/%23:hexcode', (req, res) => {
  const hexcode = req.params.hexcode;
  const imageUrl = `https://ddools.imgix.net/cars/base.png?w=600&mark-align=center,middle&mark=https%3A%2F%2Fddools.imgix.net%2Fcars%2Fpaint.png%3Fw%3D600%26bri%3D-18%26con%3D26%26monochrome%3D${hexcode}`;

  // Use the request library to fetch the image
  request(imageUrl)
    .on('error', (err) => {
      res.status(500).send('Error fetching the image');
    })
    .pipe(sharp().resize(300, 191)) // Resize the image to 300x200 using sharp
    .pipe(res); // Pipe the resized image directly to the response
});

app.get('/img-to-color', (req, res) => {
    res.render('img-to-color'); // Render 'template.ejs' without passing data
});

app.get('/auto', (req, res) => {
    res.render('auto'); // Render 'template.ejs' without passing data
});

app.get('/mobile', (req, res) => {
    res.render('mobile'); // Render 'template.ejs' without passing data
});


// Use the checkUserAgent middleware for the /playground route
app.get('/playground', redirectMobileTablet, (req, res) => {
  // This code won't be executed for mobile and tablet devices due to the redirect
  res.render('playground');
});


app.use((req, res, next) => {
  const error = new Error('Not Found');
  error.status = 404;
  next(error);
});

// Error handling middleware
app.use((error, req, res, next) => {
  res.status(error.status || 500);
  res.render('404', { theme: 'black', errorMessage: error.message });
});


app.listen(3000, () => {
  console.log('Server started on port 3000');
});
