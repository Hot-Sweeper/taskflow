const fs = require("fs");
const code = fs.readFileSync("public/shared/tilemap.js", "utf8");

// Mock document and canvas for Node.js
const document = {
  createElement: function(tag) {
    if (tag === 'canvas') {
      return {
        width: 0, height: 0,
        getContext: function() {
          return {
            fillRect: function(){},
            fillStyle: '',
            globalAlpha: 1,
            clearRect: function(){},
            beginPath: function(){},
            moveTo: function(){},
            lineTo: function(){},
            stroke: function(){},
            arc: function(){},
            fill: function(){},
            closePath: function(){},
            strokeStyle: '',
            lineWidth: 1,
            createLinearGradient: function(){ return { addColorStop: function(){} }; },
            createRadialGradient: function(){ return { addColorStop: function(){} }; },
            drawImage: function(){},
            save: function(){},
            restore: function(){},
            translate: function(){},
            rotate: function(){},
            scale: function(){},
            setTransform: function(){},
            getImageData: function(){ return { data: new Uint8ClampedArray(4) }; },
            putImageData: function(){},
            createPattern: function(){ return {}; },
            font: '',
            textAlign: '',
            textBaseline: '',
            fillText: function(){},
            measureText: function(){ return { width: 10 }; },
            clip: function(){},
            rect: function(){},
            quadraticCurveTo: function(){},
            bezierCurveTo: function(){},
            shadowColor: '',
            shadowBlur: 0,
            shadowOffsetX: 0,
            shadowOffsetY: 0,
            globalCompositeOperation: '',
            canvas: { width: 0, height: 0, toDataURL: function(){ return ''; } }
          };
        },
        toDataURL: function(){ return ''; }
      };
    }
    return {};
  }
};

const window = {};
eval(code);
const OT = window.OfficeTilemap;
OT.initTiles();
const data = OT.generate(1, 6);
const svg = OT.renderSvg(data);
console.log("SVG length:", svg.length);
console.log("Has defs:", svg.includes("<defs>"));
console.log("Has filters:", svg.includes("feGaussianBlur"));
console.log("Has AO gradients:", svg.includes("AODown"));
console.log("Has wall gradient:", svg.includes("WallGrad"));
console.log("Has screen glow:", svg.includes("ScreenGlow"));
console.log("Has light pool:", svg.includes("LightPool"));
console.log("Has furniture shadows:", svg.includes('filter="url'));
console.log("Has chair gradients:", svg.includes("ChairBack"));
console.log("Has desk gradients:", svg.includes("DeskOak"));
console.log("Has wood grain knot:", svg.includes("knot"));
console.log("Has carpet pile:", svg.includes("pile"));
console.log("Has clock tick marks:", svg.includes("tick marks"));
console.log("Has welcome mat:", svg.includes("WelcomeMat"));
console.log("Has pot gradient:", svg.includes("Pot"));
console.log("Has book spine highlights:", svg.includes('opacity="0.12"'));
console.log("Has ceiling light:", svg.includes("CeilingLight"));
console.log("Open/Close tags balanced:", (svg.match(/<svg/g) || []).length === (svg.match(/<\/svg>/g) || []).length);
console.log("Div balanced:", (svg.match(/<div/g) || []).length === (svg.match(/<\/div>/g) || []).length);
console.log("\nFirst 200 chars:", svg.substring(0, 200));
console.log("\nLast 100 chars:", svg.substring(svg.length - 100));
