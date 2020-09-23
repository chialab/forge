import { Path, Glyph as OpentypeGlyph } from 'opentype.js';
import SvgPath from 'svgpath';

function glyphToString(glyph, font) {
    return font._layoutEngine.stringsForGlyph(glyph.id)[0];
}

function glyphToUnicode(glyph, font) {
    let str = glyphToString(glyph, font);
    if (str) {
        return str.codePointAt(0);
    }
    return;
}

function pathToOpenType(path) {
    let aPath = new Path();
    path.commands.forEach(({ command, args }) => {
        aPath[command](...args);
    });
    return aPath;
}

export function glyphToOpenType(glyph, font) {
    return new Glyph({
        name: glyph.name,
        unicode: glyphToUnicode(glyph, font),
        advanceWidth: glyph.advanceWidth || 0,
        path: pathToOpenType(glyph.path),
    }, font);
}

export class Glyph extends OpentypeGlyph {
    constructor(data, font) {
        super(data);
        this.advanceWidth = data.advanceWidth || 0;

        let pathString = this.path.toSVG().replace('<path d="', '').replace('"/>', '');
        this._path = new SvgPath(pathString)
            .scale(1, -1)
            .translate(0, font.unitsPerEm)
            .translate(0, font.descent)
            .toString();
        this._viewBox = {
            x: 0,
            y: Math.round(font.descent),
            width: Math.round(this.advanceWidth || 0),
            height: Math.round(font.ascent - font.descent),
            ascent: font.ascent,
            descent: font.descent,
            baseline: font.ascent + font.descent,
        };
    }

    toPath() {
        return this._path.toString();
    }

    toSVG(header = false, guides = false) {
        let viewBox = this._viewBox;
        let content = '';
        if (header) {
            content = `<?xml version="1.0" encoding="UTF-8"?>\n${content}`;
        }
        content += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}">`;
        if (guides) {
            content += [
                `<line x1="0" y1="${viewBox.baseline}" x2="${viewBox.width}" y2="${viewBox.baseline}" style="stroke: rgb(0, 255, 255); stroke-width: 20px;" />`,
                `<line x1="0" y1="${viewBox.baseline - viewBox.ascent}" x2="${viewBox.width}" y2="${viewBox.baseline - viewBox.ascent}" style="stroke: rgb(0, 255, 255); stroke-width: 20px; stroke-dasharray: 40;" />`,
                `<line x1="0" y1="${viewBox.baseline - viewBox.descent}" x2="${viewBox.width}" y2="${viewBox.baseline - viewBox.descent}" style="stroke: rgb(0, 255, 255); stroke-width: 20px; stroke-dasharray: 40;" />`,
            ].join('\n');
        }
        content += `<path d="${this._path}"/>`;
        content += '</svg>';
        return content;
    }

    toUrl() {
        let blob = new Blob([this.toSVG()], {
            type: 'image/svg+xml',
        });
        return URL.createObjectURL(blob);
    }
}
