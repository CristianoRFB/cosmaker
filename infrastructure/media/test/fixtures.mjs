import {randomBytes} from 'node:crypto';
// Valid synthetic PDF container, random embedded stream, exact byte length; no docs assets.
export function pdfBytes(size){if(size<300)return Buffer.from('%PDF-1.7\nsynthetic\n%%EOF');const prefix=Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n3 0 obj\n<< /Type /EmbeddedFile /Length ');let amount=size-400,head,tail;for(let i=0;i<4;i++){head=Buffer.concat([prefix,Buffer.from(String(amount)+' >>\nstream\n')]);tail=Buffer.from('\nendstream\nendobj\ntrailer\n<< /Root 1 0 R /Size 4 >>\n%%EOF\n');amount=size-head.length-tail.length;}return Buffer.concat([head,randomBytes(amount),tail]);}
export const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=','base64');
export const jpeg=Buffer.from([255,216,255,224,0,16,74,70,73,70,0,255,217]);
export const webp=Buffer.concat([Buffer.from('RIFF'),Buffer.from([16,0,0,0]),Buffer.from('WEBPVP8 '),Buffer.from([0,0,0,0])]);
