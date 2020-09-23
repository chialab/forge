import { load as innerLoad, Font as OpentypeFont } from 'opentype.js';
import buffer from 'buffer/index.js';
import ttf2woff from 'ttf2woff';
import { glyphToOpenType } from './Glyph.js';
import fontkit from './vendors/fontkit.standalone.js';

function fontToOpenType(font) {
    let glyphs = [];
    for (let i = 0; i < font.numGlyphs; i++) {
        glyphs.push(glyphToOpenType(font.getGlyph(i), font));
    }
    let names = font.name?.records ?? {};
    let familyName = names.postscriptName?.en || names.fontFamily?.en || 'Untitled';
    return new Font({
        familyName: familyName
            .replace(/[^a-zA-Z0-9-]/g, '')
            .replace(/^[-]*/g, ''),
        styleName: 'Regular',
        unitsPerEm: font.unitsPerEm,
        ascender: font.ascent,
        descender: font.descent,
        glyphs,
    }, font);
}

export async function load(url) {
    let response = await fetch(url);
    let arrayBuffer = await response.arrayBuffer();
    let blob = new Blob([arrayBuffer]);
    let buff = buffer.Buffer.from(arrayBuffer);
    let font = await new Promise((resolve, reject) => {
        innerLoad(URL.createObjectURL(blob), (err, font) => {
            if (err) {
                reject(err);
            } else {
                resolve(font);
            }
        });
    });
    Object.setPrototypeOf(font, Font.prototype);
    font._fontkit = fontkit.create(buff);
    return font;
}

export class Font extends OpentypeFont {
    get fontFamily() {
        return this.names?.fontFamily?.en || 'Untitled';
    }

    get fileName() {
        return this.fontFamily.replace(/\s+/g, '-');
    }

    constructor(data, fontkit) {
        super(data);
        this._fontkit = fontkit;
    }

    getFvarTable() {
        return this.tables['fvar'];
    }

    getAxes() {
        let fvar = this.getFvarTable();
        if (fvar) {
            return fvar.axes;
        }
        return null;
    }

    getVariation(variation) {
        let font = this._fontkit.getVariation(variation);
        return fontToOpenType(font);
    }

    getGlyphs(variation) {
        let font = variation ? this._fontkit.getVariation(variation) : this._fontkit;
        let glyphs = [];
        for (let i = 0; i < font.numGlyphs; i++) {
            glyphs.push(glyphToOpenType(font.getGlyph(i), font));
        }
        return glyphs;
    }

    toBlob() {
        return new Blob([this.toArrayBuffer()], { type: 'font/ttf' });
    }

    toSVG(subset) {
        let glyphs = this.getGlyphs();
        if (subset) {
            glyphs = glyphs.filter((glyph) => subset.includes(glyph.name));
        }
        return glyphs
            .map((glyph) => ({
                name: `${glyph.name}.svg`,
                content: glyph.toSVG(true),
            }));
    }

    toWoff() {
        let buffer = this.toArrayBuffer();
        let uint8View = new Uint8Array(buffer);
        let woff = ttf2woff(uint8View);
        return new Blob([woff], { type: 'font/woff' });
    }

    toFormat(format) {
        switch (format) {
            case 'woff':
                return this.toWoff();
            default:
                throw new Error('unhandled format');
        }
    }

    toCSSFontFace(familyName = this.fontFamily, dir = 'fonts', formats = ['woff']) {
        let files = formats.map((format) => (
            {
                name: `${dir}/${familyName.replace(/\s+/g, '-').toLowerCase()}.${format}`,
                content: this.toFormat(format),
                format,
            }
        ));

        return {
            css: `@font-face {
    font-family: '${familyName}';
    font-weight: normal;
    font-style: normal;
    font-display: block;
    src: ${files.map(({ name, format }) => `url('${name}') format('${format}')`).join(', ')};
}
`,
            files,
        };
    }

    toCSS(prefix = 'icon-', familyName = this.fontFamily) {
        let glyphs = this.getGlyphs();
        let generic = `[class^='${prefix}'],
[class*=' ${prefix}'] {
    font-family: '${familyName}';
    font-weight: normal;
    font-style: normal;
    font-variant: normal;
    line-height: 1;
    letter-spacing: 0;
    text-transform: none;
    -webkit-font-feature-settings: 'liga';
    -moz-font-feature-settings: 'liga=1';
    -moz-font-feature-settings: 'liga';
    -ms-font-feature-settings: 'liga' 1;
    font-feature-settings: 'liga';
    -webkit-font-variant-ligatures: discretionary-ligatures;
    font-variant-ligatures: discretionary-ligatures;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}`;
        let classes = glyphs
            .filter((glyph) => glyph.unicode != null)
            .map((glyph) => `.${prefix}${glyph.name}::before {
    content: '\\${glyph.unicode.toString(16)}';
}`);
        return `${generic}\n\n${classes.join('\n\n')}\n`;
    }
}
