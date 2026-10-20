import "server-only";
import sharp from "sharp";
import { currentConn } from "@/db";
import { getFile } from "@/lib/blob";
import { brandShortName, getWhiteLabel } from "@/lib/queries";
import path from "node:path";
import { WATERMARK_DEFAULTS, type WatermarkSettings } from "@/lib/watermark-settings";

/**
 * Marca d'água das fotos do site: o logo da empresa (Configurações › Marca), o
 * logotipo Carlos Amâncio na empresa que usa o símbolo padrão (vetor do manual,
 * texto já em curvas) ou, sem logo, o nome da marca como no menu, em branco
 * translúcido, centralizado, com sombra leve para aparecer em céu claro, e
 * linhas diagonais finas (estilo banco de imagens). Ajustes em Configurações.
 */
const LOGO = "<defs>\n<g>\n<g id=\"glyph-0-0\">\n<path d=\"M 18.875 -3.484375 C 17.015625 -1.671875 14.59375 -0.734375 12.15625 -0.734375 C 6.03125 -0.734375 2.703125 -5.015625 2.640625 -10.171875 C 2.609375 -15.4375 5.921875 -19.828125 12.15625 -19.828125 C 14.59375 -19.828125 17.015625 -18.953125 18.890625 -17.078125 L 19.546875 -17.703125 C 17.515625 -19.75 14.828125 -20.75 12.15625 -20.75 C 5.21875 -20.75 1.609375 -15.640625 1.703125 -10.140625 C 1.734375 -4.578125 5.421875 0.171875 12.15625 0.171875 C 14.796875 0.171875 17.515625 -0.84375 19.546875 -2.90625 Z M 18.875 -3.484375 \"/>\n</g>\n<g id=\"glyph-0-1\">\n<path d=\"M 0.9375 0 L 2.046875 0 L 4.390625 -5.328125 L 16.96875 -5.328125 L 19.34375 0 L 20.453125 0 L 11.25 -20.515625 L 10.140625 -20.515625 Z M 4.75 -6.234375 L 10.6875 -19.625 L 16.578125 -6.234375 Z M 4.75 -6.234375 \"/>\n</g>\n<g id=\"glyph-0-2\">\n<path d=\"M 17.671875 0 L 18.921875 0 L 11.453125 -8.0625 C 16.265625 -7.859375 18.34375 -10.78125 18.3125 -14.234375 C 18.28125 -17.34375 16.234375 -20.515625 11.890625 -20.515625 L 3.046875 -20.515625 L 3.046875 0 L 3.984375 0 L 3.984375 -8.0625 L 10.21875 -8.0625 Z M 3.984375 -8.96875 L 3.984375 -19.59375 L 11.890625 -19.59375 C 15.53125 -19.59375 17.375 -16.9375 17.375 -14.234375 C 17.375 -11.078125 15.5 -8.96875 11.65625 -8.96875 Z M 3.984375 -8.96875 \"/>\n</g>\n<g id=\"glyph-0-3\">\n<path d=\"M 3.046875 -20.515625 L 3.046875 0 L 15.84375 0 L 15.84375 -0.90625 L 3.984375 -0.90625 L 3.984375 -20.515625 Z M 3.046875 -20.515625 \"/>\n</g>\n<g id=\"glyph-0-4\">\n<path d=\"M 11.921875 -20.765625 C 4.78125 -20.765625 1.671875 -15.328125 1.671875 -10.3125 C 1.671875 -4.890625 5.15625 0.296875 11.953125 0.296875 C 18.78125 0.296875 22.234375 -4.828125 22.265625 -10.25 C 22.265625 -15.640625 18.84375 -20.796875 11.921875 -20.765625 Z M 21.328125 -10.25 C 21.359375 -5.328125 18.078125 -0.609375 11.953125 -0.609375 C 5.796875 -0.609375 2.640625 -5.453125 2.609375 -10.28125 C 2.578125 -15.09375 5.65625 -19.859375 11.921875 -19.859375 C 18.109375 -19.859375 21.328125 -15.359375 21.328125 -10.25 Z M 21.328125 -10.25 \"/>\n</g>\n<g id=\"glyph-0-5\">\n<path d=\"M 16.84375 -17.703125 C 14.9375 -20.046875 12.15625 -20.71875 9.640625 -20.71875 C 6.359375 -20.71875 1.875 -19.515625 2 -15.140625 C 2 -11.578125 5.828125 -10.875 9.46875 -10.078125 C 12.984375 -9.34375 16.765625 -8.765625 16.734375 -5.296875 C 16.734375 -1.3125 12.25 -0.640625 9.734375 -0.640625 C 7.15625 -0.640625 3.640625 -1.875 2.25 -4.515625 L 1.4375 -4.046875 C 3.046875 -1.0625 6.765625 0.265625 9.734375 0.265625 C 12.859375 0.265625 17.640625 -0.671875 17.671875 -5.296875 C 17.671875 -9.4375 13.59375 -10.171875 9.734375 -10.984375 C 6 -11.71875 2.9375 -12.359375 2.9375 -15.140625 C 2.9375 -19.21875 7.265625 -19.8125 9.609375 -19.8125 C 11.8125 -19.8125 14.59375 -19.25 16.203125 -17.046875 Z M 16.84375 -17.703125 \"/>\n</g>\n<g id=\"glyph-0-6\">\n</g>\n<g id=\"glyph-1-0\">\n<path d=\"M 18.3125 0 L 23.265625 0 L 14.0625 -20.515625 L 9.078125 -20.515625 L -0.125 0 L 4.8125 0 L 6.296875 -3.515625 L 16.8125 -3.515625 Z M 15.09375 -7.5625 L 8.03125 -7.5625 L 11.578125 -15.875 Z M 15.09375 -7.5625 \"/>\n</g>\n<g id=\"glyph-1-1\">\n<path d=\"M 20.125 0.03125 L 24.703125 0.03125 L 24.703125 -20.484375 L 19.515625 -20.484375 L 13.5 -12.59375 L 7.53125 -20.484375 C 5.796875 -20.484375 4.015625 -20.484375 2.28125 -20.484375 L 2.28125 0.03125 L 6.859375 0.03125 L 6.859375 -14.296875 L 12.984375 -6.265625 L 13.796875 -6.265625 L 20.125 -14.234375 Z M 20.125 0.03125 \"/>\n</g>\n<g id=\"glyph-1-2\">\n<path d=\"M 16.8125 -3.515625 L 6.296875 -3.515625 L 4.8125 0 L -0.125 0 L 9.078125 -20.515625 L 14.0625 -20.515625 L 23.265625 0 L 18.3125 0 Z M 11.578125 -15.875 L 8.03125 -7.5625 L 15.09375 -7.5625 Z M 10.453125 -26.578125 L 6.0625 -22.46875 L 6.0625 -22.328125 L 10.203125 -22.328125 L 11.546875 -23.5625 L 12.921875 -22.328125 L 17.015625 -22.328125 L 17.015625 -22.46875 L 12.65625 -26.578125 Z M 10.453125 -26.578125 \"/>\n</g>\n<g id=\"glyph-1-3\">\n<path d=\"M 6.21875 -20.515625 L 2.28125 -20.515625 L 2.28125 0 L 6.921875 0 L 6.921875 -6.390625 L 6.734375 -13.125 L 16.9375 0 L 20.859375 0 L 20.859375 -20.515625 L 16.265625 -20.515625 L 16.265625 -13.625 L 16.546875 -7.171875 Z M 6.21875 -20.515625 \"/>\n</g>\n<g id=\"glyph-1-4\">\n<path d=\"M 17.109375 -5.65625 C 15.875 -4.421875 13.71875 -3.6875 12.078125 -3.6875 C 7.265625 -3.6875 5.65625 -7.09375 5.625 -10.078125 C 5.59375 -13.0625 7.40625 -16.671875 12.078125 -16.671875 C 13.71875 -16.671875 15.5 -16.171875 16.734375 -14.96875 L 19.59375 -17.8125 C 17.484375 -19.890625 14.890625 -20.984375 12.078125 -20.984375 C 4.546875 -20.984375 1.078125 -15.40625 1.109375 -10.109375 C 1.140625 -4.515625 4.25 0.53125 12.078125 0.53125 C 15.125 0.53125 17.84375 -0.40625 19.953125 -2.484375 Z M 17.109375 -5.65625 \"/>\n</g>\n<g id=\"glyph-1-5\">\n<path d=\"M 6.828125 0 L 6.828125 -20.515625 L 2.28125 -20.515625 L 2.28125 0 Z M 6.828125 0 \"/>\n</g>\n<g id=\"glyph-1-6\">\n<path d=\"M 23.265625 -10.25 C 23.265625 -16.9375 18.75 -21 12.1875 -21 C 5.625 -21 1.109375 -16.9375 1.109375 -10.25 C 1.109375 -3.578125 5.625 0.5 12.1875 0.5 C 18.75 0.5 23.265625 -3.578125 23.265625 -10.25 Z M 18.78125 -10.25 C 18.78125 -6.453125 16.171875 -3.640625 12.1875 -3.640625 C 8.296875 -3.640625 5.59375 -6.421875 5.59375 -10.25 C 5.59375 -13.96875 8.296875 -16.90625 12.1875 -16.90625 C 16.171875 -16.90625 18.78125 -14 18.78125 -10.25 Z M 18.78125 -10.25 \"/>\n</g>\n<g id=\"glyph-2-0\">\n<path d=\"M 1.875 0 L 1.875 -9.671875 L 1.4375 -9.671875 L 1.4375 0 Z M 1.875 0 \"/>\n</g>\n<g id=\"glyph-2-1\">\n<path d=\"M 9.890625 0 L 10.328125 0 L 10.328125 -9.671875 L 9.703125 -9.671875 L 5.890625 -3.671875 L 2.015625 -9.671875 L 1.4375 -9.671875 L 1.4375 0 L 1.875 0 L 1.875 -9.078125 L 5.828125 -3 L 5.96875 -3 L 9.890625 -9.109375 Z M 9.890625 0 \"/>\n</g>\n<g id=\"glyph-2-2\">\n<path d=\"M 5.625 -9.796875 C 2.25 -9.796875 0.78125 -7.234375 0.78125 -4.875 C 0.78125 -2.3125 2.4375 0.140625 5.640625 0.140625 C 8.859375 0.140625 10.5 -2.28125 10.515625 -4.84375 C 10.515625 -7.390625 8.890625 -9.8125 5.625 -9.796875 Z M 10.0625 -4.84375 C 10.078125 -2.515625 8.53125 -0.296875 5.640625 -0.296875 C 2.734375 -0.296875 1.25 -2.578125 1.234375 -4.859375 C 1.21875 -7.125 2.671875 -9.375 5.625 -9.375 C 8.546875 -9.375 10.0625 -7.25 10.0625 -4.84375 Z M 5.828125 -10.5625 L 7.015625 -12.203125 L 6.46875 -12.203125 L 5.421875 -10.609375 L 5.421875 -10.5625 Z M 5.828125 -10.5625 \"/>\n</g>\n<g id=\"glyph-2-3\">\n<path d=\"M 4.484375 0.03125 L 5 0.03125 L 8.96875 -9.671875 L 8.484375 -9.671875 L 4.75 -0.5 L 1 -9.671875 L 0.5 -9.671875 Z M 4.484375 0.03125 \"/>\n</g>\n<g id=\"glyph-2-4\">\n<path d=\"M 1.875 -0.421875 L 1.875 -4.671875 L 7.6875 -4.671875 L 7.6875 -5.109375 L 1.875 -5.109375 L 1.875 -9.25 L 7.984375 -9.25 L 7.984375 -9.671875 L 1.4375 -9.671875 L 1.4375 0 L 8.1875 0 L 8.1875 -0.421875 Z M 1.875 -0.421875 \"/>\n</g>\n<g id=\"glyph-2-5\">\n<path d=\"M 7.953125 -8.359375 C 7.046875 -9.453125 5.734375 -9.78125 4.546875 -9.78125 C 3 -9.78125 0.890625 -9.203125 0.9375 -7.15625 C 0.9375 -5.46875 2.75 -5.125 4.46875 -4.75 C 6.125 -4.40625 7.90625 -4.140625 7.890625 -2.5 C 7.890625 -0.625 5.78125 -0.296875 4.59375 -0.296875 C 3.375 -0.296875 1.71875 -0.890625 1.0625 -2.125 L 0.671875 -1.90625 C 1.4375 -0.5 3.1875 0.125 4.59375 0.125 C 6.078125 0.125 8.328125 -0.3125 8.34375 -2.5 C 8.34375 -4.453125 6.421875 -4.796875 4.59375 -5.1875 C 2.828125 -5.53125 1.375 -5.828125 1.375 -7.15625 C 1.375 -9.078125 3.421875 -9.34375 4.53125 -9.34375 C 5.578125 -9.34375 6.890625 -9.078125 7.640625 -8.046875 Z M 7.953125 -8.359375 \"/>\n</g>\n</g>\n<clipPath id=\"clip-0\">\n<path clip-rule=\"nonzero\" d=\"M 0 0.34375 L 594.554688 0.34375 L 594.554688 149 L 0 149 Z M 0 0.34375 \"/>\n</clipPath>\n</defs><g id=\"logo\">\n<g fill=\"#ffffff\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-0-0\" x=\"222.320404\" y=\"250.64978\"/>\n</g>\n<g fill=\"#ffffff\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-0-1\" x=\"243.060395\" y=\"250.64978\"/>\n<use xlink:href=\"#glyph-0-2\" x=\"264.444848\" y=\"250.64978\"/>\n<use xlink:href=\"#glyph-0-3\" x=\"284.716138\" y=\"250.64978\"/>\n</g>\n<g fill=\"#ffffff\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-0-4\" x=\"299.538787\" y=\"250.64978\"/>\n<use xlink:href=\"#glyph-0-5\" x=\"323.471798\" y=\"250.64978\"/>\n<use xlink:href=\"#glyph-0-6\" x=\"342.600631\" y=\"250.64978\"/>\n</g>\n<g fill=\"#ffffff\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-1-0\" x=\"350.539243\" y=\"250.64978\"/>\n<use xlink:href=\"#glyph-1-1\" x=\"373.681323\" y=\"250.64978\"/>\n<use xlink:href=\"#glyph-1-2\" x=\"400.660886\" y=\"250.64978\"/>\n<use xlink:href=\"#glyph-1-3\" x=\"423.802966\" y=\"250.64978\"/>\n<use xlink:href=\"#glyph-1-4\" x=\"446.945046\" y=\"250.64978\"/>\n<use xlink:href=\"#glyph-1-5\" x=\"467.333511\" y=\"250.64978\"/>\n<use xlink:href=\"#glyph-1-6\" x=\"476.443874\" y=\"250.64978\"/>\n</g>\n<g fill=\"#ffffff\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-2-0\" x=\"429.576631\" y=\"275.577461\"/>\n<use xlink:href=\"#glyph-2-1\" x=\"435.109941\" y=\"275.577461\"/>\n<use xlink:href=\"#glyph-2-2\" x=\"449.095382\" y=\"275.577461\"/>\n</g>\n<g fill=\"#ffffff\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-2-3\" x=\"462.209327\" y=\"275.577461\"/>\n<use xlink:href=\"#glyph-2-4\" x=\"473.912278\" y=\"275.577461\"/>\n<use xlink:href=\"#glyph-2-0\" x=\"485.144898\" y=\"275.577461\"/>\n<use xlink:href=\"#glyph-2-5\" x=\"490.678208\" y=\"275.577461\"/>\n</g>\n<path fill-rule=\"nonzero\" fill=\"#ffffff\" fill-opacity=\"1\" d=\"M 202.191406 286.503906 L 209.597656 302.335938 C 206.058594 306.050781 202.097656 309.359375 197.800781 312.1875 C 197.550781 312.367188 197.296875 312.535156 197.042969 312.691406 C 186.484375 319.460938 173.945312 323.386719 160.511719 323.386719 C 149.445312 323.386719 138.976562 320.71875 129.738281 315.988281 L 136.460938 301.550781 C 143.660156 305.335938 151.84375 307.46875 160.511719 307.46875 C 168.957031 307.46875 176.933594 305.445312 183.992188 301.851562 C 185.539062 301.066406 187.042969 300.203125 188.496094 299.269531 C 188.65625 299.175781 188.816406 299.0625 188.972656 298.957031 C 194.074219 295.609375 198.550781 291.382812 202.191406 286.503906 \"/>\n<path fill-rule=\"nonzero\" fill=\"#ffffff\" fill-opacity=\"1\" d=\"M 203.558594 203.070312 L 196.558594 218.121094 C 193.523438 215.195312 190.140625 212.636719 186.472656 210.511719 C 178.828125 206.085938 169.960938 203.550781 160.511719 203.550781 C 131.855469 203.550781 108.542969 226.859375 108.542969 255.507812 C 108.542969 265.59375 111.4375 275.019531 116.433594 282.996094 L 108.523438 299.109375 C 98.609375 287.3125 92.628906 272.097656 92.628906 255.507812 C 92.628906 218.078125 123.082031 187.632812 160.511719 187.632812 C 172.355469 187.632812 183.503906 190.683594 193.207031 196.039062 C 196.878906 198.066406 200.34375 200.421875 203.558594 203.070312 \"/>\n<path fill-rule=\"nonzero\" fill=\"#ffffff\" fill-opacity=\"1\" d=\"M 200.210938 282.277344 C 196.46875 288.015625 191.515625 292.921875 185.730469 296.613281 L 160.507812 240.980469 L 134.46875 296.949219 L 124.539062 318.285156 L 123.964844 319.519531 L 103.378906 319.519531 L 109.492188 306.835938 L 120.550781 283.90625 L 151.164062 220.402344 L 171.273438 220.402344 Z M 200.210938 282.277344 \"/>\n<path fill-rule=\"nonzero\" fill=\"#F47525\" fill-opacity=\"1\" d=\"M 217.636719 319.519531 L 196.113281 319.519531 L 195.457031 318.078125 C 201.269531 314.726562 206.570312 310.589844 211.222656 305.804688 Z M 217.636719 319.519531 \"/>\n<g fill=\"#ffffff\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-0-0\" x=\"15.882982\" y=\"548.496526\"/>\n</g>\n<g fill=\"#ffffff\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-0-1\" x=\"36.622973\" y=\"548.496526\"/>\n<use xlink:href=\"#glyph-0-2\" x=\"58.007426\" y=\"548.496526\"/>\n<use xlink:href=\"#glyph-0-3\" x=\"78.278716\" y=\"548.496526\"/>\n</g>\n<g fill=\"#ffffff\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-0-4\" x=\"93.101365\" y=\"548.496526\"/>\n<use xlink:href=\"#glyph-0-5\" x=\"117.034376\" y=\"548.496526\"/>\n<use xlink:href=\"#glyph-0-6\" x=\"136.163209\" y=\"548.496526\"/>\n</g>\n<g fill=\"#ffffff\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-1-0\" x=\"144.101821\" y=\"548.496526\"/>\n<use xlink:href=\"#glyph-1-1\" x=\"167.243901\" y=\"548.496526\"/>\n<use xlink:href=\"#glyph-1-2\" x=\"194.223464\" y=\"548.496526\"/>\n<use xlink:href=\"#glyph-1-3\" x=\"217.365544\" y=\"548.496526\"/>\n<use xlink:href=\"#glyph-1-4\" x=\"240.507624\" y=\"548.496526\"/>\n<use xlink:href=\"#glyph-1-5\" x=\"260.896089\" y=\"548.496526\"/>\n<use xlink:href=\"#glyph-1-6\" x=\"270.006452\" y=\"548.496526\"/>\n</g>\n<g fill=\"#ffffff\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-2-0\" x=\"118.957818\" y=\"573.423209\"/>\n<use xlink:href=\"#glyph-2-1\" x=\"124.491129\" y=\"573.423209\"/>\n<use xlink:href=\"#glyph-2-2\" x=\"138.47657\" y=\"573.423209\"/>\n</g>\n<g fill=\"#ffffff\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-2-3\" x=\"151.590515\" y=\"573.423209\"/>\n<use xlink:href=\"#glyph-2-4\" x=\"163.293466\" y=\"573.423209\"/>\n<use xlink:href=\"#glyph-2-0\" x=\"174.526086\" y=\"573.423209\"/>\n<use xlink:href=\"#glyph-2-5\" x=\"180.059396\" y=\"573.423209\"/>\n</g>\n<path fill-rule=\"nonzero\" fill=\"#ffffff\" fill-opacity=\"1\" d=\"M 202.191406 469.75 L 209.597656 485.585938 C 206.058594 489.296875 202.097656 492.605469 197.800781 495.4375 C 197.550781 495.613281 197.296875 495.78125 197.042969 495.941406 C 186.484375 502.710938 173.945312 506.632812 160.511719 506.632812 C 149.445312 506.632812 138.976562 503.964844 129.738281 499.238281 L 136.460938 484.800781 C 143.660156 488.582031 151.84375 490.71875 160.511719 490.71875 C 168.957031 490.71875 176.933594 488.695312 183.992188 485.097656 C 185.539062 484.3125 187.042969 483.453125 188.496094 482.515625 C 188.65625 482.421875 188.816406 482.3125 188.972656 482.207031 C 194.074219 478.855469 198.550781 474.632812 202.191406 469.75 \"/>\n<path fill-rule=\"nonzero\" fill=\"#ffffff\" fill-opacity=\"1\" d=\"M 203.558594 386.316406 L 196.558594 401.367188 C 193.523438 398.441406 190.140625 395.882812 186.472656 393.757812 C 178.828125 389.332031 169.960938 386.796875 160.511719 386.796875 C 131.855469 386.796875 108.542969 410.109375 108.542969 438.757812 C 108.542969 448.839844 111.4375 458.269531 116.433594 466.246094 L 108.523438 482.355469 C 98.609375 470.558594 92.628906 455.347656 92.628906 438.757812 C 92.628906 401.328125 123.082031 370.878906 160.511719 370.878906 C 172.355469 370.878906 183.503906 373.929688 193.207031 379.285156 C 196.878906 381.3125 200.34375 383.667969 203.558594 386.316406 \"/>\n<path fill-rule=\"nonzero\" fill=\"#ffffff\" fill-opacity=\"1\" d=\"M 200.210938 465.527344 C 196.46875 471.265625 191.515625 476.171875 185.730469 479.859375 L 160.507812 424.230469 L 134.46875 480.195312 L 124.539062 501.535156 L 123.964844 502.769531 L 103.378906 502.769531 L 109.492188 490.082031 L 120.550781 467.15625 L 151.164062 403.652344 L 171.273438 403.652344 Z M 200.210938 465.527344 \"/>\n<path fill-rule=\"nonzero\" fill=\"#F47525\" fill-opacity=\"1\" d=\"M 217.636719 502.769531 L 196.113281 502.769531 L 195.457031 501.328125 C 201.269531 497.976562 206.570312 493.839844 211.222656 489.054688 Z M 217.636719 502.769531 \"/>\n<path fill-rule=\"nonzero\" fill=\"#ffffff\" fill-opacity=\"1\" d=\"M 480.203125 469.75 L 487.609375 485.585938 C 484.070312 489.296875 480.109375 492.605469 475.8125 495.4375 C 475.5625 495.613281 475.308594 495.78125 475.054688 495.941406 C 464.496094 502.710938 451.960938 506.632812 438.523438 506.632812 C 427.457031 506.632812 416.992188 503.964844 407.75 499.238281 L 414.472656 484.800781 C 421.671875 488.582031 429.855469 490.71875 438.523438 490.71875 C 446.96875 490.71875 454.945312 488.695312 462.003906 485.097656 C 463.550781 484.3125 465.058594 483.453125 466.507812 482.515625 C 466.667969 482.421875 466.828125 482.3125 466.984375 482.207031 C 472.085938 478.855469 476.5625 474.632812 480.203125 469.75 \"/>\n<path fill-rule=\"nonzero\" fill=\"#ffffff\" fill-opacity=\"1\" d=\"M 481.574219 386.316406 L 474.570312 401.367188 C 471.539062 398.441406 468.152344 395.882812 464.484375 393.757812 C 456.839844 389.332031 447.972656 386.796875 438.523438 386.796875 C 409.867188 386.796875 386.554688 410.109375 386.554688 438.757812 C 386.554688 448.839844 389.449219 458.269531 394.449219 466.246094 L 386.535156 482.355469 C 376.621094 470.558594 370.640625 455.347656 370.640625 438.757812 C 370.640625 401.328125 401.09375 370.878906 438.523438 370.878906 C 450.367188 370.878906 461.515625 373.929688 471.21875 379.285156 C 474.890625 381.3125 478.355469 383.667969 481.574219 386.316406 \"/>\n<path fill-rule=\"nonzero\" fill=\"#ffffff\" fill-opacity=\"1\" d=\"M 478.226562 465.527344 C 474.480469 471.265625 469.527344 476.171875 463.742188 479.859375 L 438.519531 424.230469 L 412.484375 480.195312 L 402.550781 501.535156 L 401.980469 502.769531 L 381.390625 502.769531 L 387.503906 490.082031 L 398.5625 467.15625 L 429.175781 403.652344 L 449.285156 403.652344 Z M 478.226562 465.527344 \"/>\n<path fill-rule=\"nonzero\" fill=\"#F47525\" fill-opacity=\"1\" d=\"M 495.648438 502.769531 L 474.125 502.769531 L 473.46875 501.328125 C 479.28125 497.976562 484.582031 493.839844 489.234375 489.054688 Z M 495.648438 502.769531 \"/>\n<g clip-path=\"url(#clip-0)\">\n<path fill-rule=\"nonzero\" fill=\"#ffffff\" fill-opacity=\"1\" d=\"M 594.921875 148.503906 L -0.371094 148.503906 L -0.371094 -2.3125 L 594.921875 -2.3125 Z M 594.921875 148.503906 \"/>\n</g>\n<g fill=\"rgb(100%, 100%, 100%)\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-0-0\" x=\"222.876428\" y=\"68.236938\"/>\n</g>\n<g fill=\"rgb(100%, 100%, 100%)\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-0-1\" x=\"243.616419\" y=\"68.236938\"/>\n<use xlink:href=\"#glyph-0-2\" x=\"265.000872\" y=\"68.236938\"/>\n<use xlink:href=\"#glyph-0-3\" x=\"285.272162\" y=\"68.236938\"/>\n</g>\n<g fill=\"rgb(100%, 100%, 100%)\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-0-4\" x=\"300.09481\" y=\"68.236938\"/>\n<use xlink:href=\"#glyph-0-5\" x=\"324.027822\" y=\"68.236938\"/>\n<use xlink:href=\"#glyph-0-6\" x=\"343.156655\" y=\"68.236938\"/>\n</g>\n<g fill=\"rgb(100%, 100%, 100%)\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-1-0\" x=\"351.095267\" y=\"68.236938\"/>\n<use xlink:href=\"#glyph-1-1\" x=\"374.237346\" y=\"68.236938\"/>\n<use xlink:href=\"#glyph-1-2\" x=\"401.21691\" y=\"68.236938\"/>\n<use xlink:href=\"#glyph-1-3\" x=\"424.35899\" y=\"68.236938\"/>\n<use xlink:href=\"#glyph-1-4\" x=\"447.501069\" y=\"68.236938\"/>\n<use xlink:href=\"#glyph-1-5\" x=\"467.889534\" y=\"68.236938\"/>\n<use xlink:href=\"#glyph-1-6\" x=\"476.999897\" y=\"68.236938\"/>\n</g>\n<g fill=\"rgb(100%, 100%, 100%)\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-2-0\" x=\"430.132654\" y=\"93.16462\"/>\n<use xlink:href=\"#glyph-2-1\" x=\"435.665965\" y=\"93.16462\"/>\n<use xlink:href=\"#glyph-2-2\" x=\"449.651406\" y=\"93.16462\"/>\n</g>\n<g fill=\"rgb(100%, 100%, 100%)\" fill-opacity=\"1\">\n<use xlink:href=\"#glyph-2-3\" x=\"462.765351\" y=\"93.16462\"/>\n<use xlink:href=\"#glyph-2-4\" x=\"474.468302\" y=\"93.16462\"/>\n<use xlink:href=\"#glyph-2-0\" x=\"485.700922\" y=\"93.16462\"/>\n<use xlink:href=\"#glyph-2-5\" x=\"491.234232\" y=\"93.16462\"/>\n</g>\n<path fill-rule=\"nonzero\" fill=\"rgb(100%, 100%, 100%)\" fill-opacity=\"1\" d=\"M 202.746094 104.089844 L 210.152344 119.921875 C 206.613281 123.636719 202.652344 126.945312 198.359375 129.773438 C 198.105469 129.953125 197.851562 130.121094 197.597656 130.277344 C 187.039062 137.050781 174.503906 140.972656 161.066406 140.972656 C 150 140.972656 139.535156 138.304688 130.292969 133.574219 L 137.015625 119.140625 C 144.214844 122.921875 152.398438 125.054688 161.066406 125.054688 C 169.511719 125.054688 177.488281 123.03125 184.546875 119.4375 C 186.09375 118.652344 187.601562 117.789062 189.050781 116.855469 C 189.210938 116.761719 189.371094 116.648438 189.527344 116.542969 C 194.628906 113.195312 199.105469 108.96875 202.746094 104.089844 \"/>\n<path fill-rule=\"nonzero\" fill=\"rgb(100%, 100%, 100%)\" fill-opacity=\"1\" d=\"M 204.117188 20.65625 L 197.113281 35.707031 C 194.082031 32.78125 190.695312 30.222656 187.027344 28.097656 C 179.386719 23.671875 170.515625 21.136719 161.066406 21.136719 C 132.410156 21.136719 109.097656 44.445312 109.097656 73.09375 C 109.097656 83.179688 111.992188 92.605469 116.992188 100.582031 L 109.078125 116.695312 C 99.164062 104.898438 93.183594 89.6875 93.183594 73.09375 C 93.183594 35.664062 123.636719 5.21875 161.066406 5.21875 C 172.910156 5.21875 184.058594 8.269531 193.761719 13.625 C 197.433594 15.652344 200.898438 18.007812 204.117188 20.65625 \"/>\n<path fill-rule=\"nonzero\" fill=\"rgb(100%, 100%, 100%)\" fill-opacity=\"1\" d=\"M 200.769531 99.863281 C 197.023438 105.601562 192.070312 110.507812 186.285156 114.199219 L 161.0625 58.566406 L 135.027344 114.535156 L 125.09375 135.871094 L 124.523438 137.105469 L 103.933594 137.105469 L 110.050781 124.421875 L 121.105469 101.492188 L 151.71875 37.988281 L 171.828125 37.988281 Z M 200.769531 99.863281 \"/>\n<path fill-rule=\"nonzero\" fill=\"#F47525\" fill-opacity=\"1\" d=\"M 218.191406 137.109375 L 196.667969 137.109375 L 196.011719 135.664062 C 201.828125 132.3125 207.125 128.175781 211.777344 123.390625 Z M 218.191406 137.109375 \"/>\n</g>";

const SHADOW = `<filter id="s" x="-10%" y="-10%" width="120%" height="120%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="2.2"/>
  <feOffset dy="0.8" result="b"/>
  <feFlood flood-color="#000" flood-opacity="0.35"/>
  <feComposite in2="b" operator="in" result="sh"/>
  <feMerge><feMergeNode in="sh"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>`;

function logoSvg(width: number, opacity: number) {
  const h = Math.round((width * 230) / 300);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${h}" viewBox="8 362 300 230">
${SHADOW}
<g opacity="${opacity}" filter="url(#s)">${LOGO}</g>
</svg>`;
}

/** Logo enviado pela empresa (PNG), com a mesma opacidade e sombra do padrão */
function customLogoSvg(png: Buffer, ratio: number, width: number, opacity: number) {
  const h = Math.max(1, Math.round(width * ratio));
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${h}">
${SHADOW}
<g opacity="${opacity}" filter="url(#s)"><image width="${width}" height="${h}" xlink:href="data:image/png;base64,${png.toString("base64")}"/></g>
</svg>`;
}

/**
 * Logo da marca d'água: "padrao" (símbolo Carlos Amâncio), o logo da empresa
 * (PNG + altura/largura) ou null (empresa sem logo: só as linhas).
 */
export type WatermarkLogo = { kind: "padrao" } | { kind: "empresa"; png: Buffer; ratio: number } | null;

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

async function readLogo(url: string): Promise<Buffer | null> {
  const media = url.split("/api/media/")[1]?.split("?")[0];
  if (media) {
    const f = await getFile(decodeURIComponent(media));
    if (!f || f.size > MAX_LOGO_BYTES) return null;
    return Buffer.from(await new Response(f.stream).arrayBuffer());
  }
  if (!/^https:\/\//.test(url)) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!res?.ok || Number(res.headers.get("content-length") ?? 0) > MAX_LOGO_BYTES) return null;
  return Buffer.from(await res.arrayBuffer());
}

/* Nome da marca como no menu (Wordmark): primeiro nome fino, resto pesado e o
 * subtítulo espaçado. Montserrat vem em public/fonts (o servidor não tem fontes). */
const FONT_DIR = path.join(process.cwd(), "public", "fonts", "montserrat");
const FONTS = ["Montserrat_200ExtraLight.ttf", "Montserrat_500Medium.ttf", "Montserrat_800ExtraBold.ttf"];
let fontsReady: Promise<void> | null = null;

/** Registra as três espessuras no fontconfig do processo (o libvips guarda o arquivo) */
function loadFonts() {
  fontsReady ??= (async () => {
    for (const f of FONTS) {
      await sharp({ text: { text: ".", font: "Montserrat", fontfile: path.join(FONT_DIR, f) } }).png().toBuffer();
    }
  })().catch((e) => {
    fontsReady = null;
    throw e;
  });
  return fontsReady;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function wordmarkPng(name: string, sub: string) {
  const [first, ...rest] = name.trim().toLocaleUpperCase("pt-BR").split(/\s+/);
  if (!first) return null;
  await loadFonts();
  const subtitle = sub.trim().toLocaleUpperCase("pt-BR");
  const markup =
    `<span foreground="#ffffff"><span weight="200">${esc(first)}</span>` +
    (rest.length ? ` <span weight="800">${esc(rest.join(" "))}</span>` : "") +
    (subtitle ? `\n<span size="38%" weight="500" letter_spacing="6000">${esc(subtitle)}</span>` : "") +
    `</span>`;
  const { data, info } = await sharp({
    text: {
      text: markup,
      font: "Montserrat 48",
      fontfile: path.join(FONT_DIR, FONTS[2]),
      dpi: 150,
      rgba: true,
      align: "centre",
      spacing: 6,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { png: data, ratio: info.height / info.width };
}

const logoCache = new Map<string, { at: number; value: WatermarkLogo }>();

/** Logo da empresa atual para a marca d'água (cache de 1 min por empresa) */
export async function getWatermarkLogo(): Promise<WatermarkLogo> {
  const key = (await currentConn()).schema;
  const hit = logoCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const wl = await getWhiteLabel();
  // Logo para fundo escuro primeiro: contrasta melhor sobre as fotos
  const url = wl.logoDarkUrl || wl.logoUrl || wl.iconUrl;
  let value: WatermarkLogo = wl.showMark ? { kind: "padrao" } : null;
  if (url) {
    try {
      const raw = await readLogo(url);
      if (raw) {
        const { data, info } = await sharp(raw, { failOn: "none" })
          .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer({ resolveWithObject: true });
        value = { kind: "empresa", png: data, ratio: info.height / info.width };
      }
    } catch (e) {
      console.error("[marca d'água] logo da empresa", e);
    }
  }
  // Sem logo nem símbolo padrão: o nome da marca, como aparece no menu
  if (!value) {
    try {
      const mark = await wordmarkPng(brandShortName(wl), wl.brandSub);
      if (mark) value = { kind: "empresa", ...mark };
    } catch (e) {
      console.error("[marca d'água] nome da marca", e);
    }
  }
  logoCache.set(key, { at: Date.now(), value });
  return value;
}

/** Linhas diagonais finas sobre a foto inteira (uma direção ou cruzadas). */
function linesSvg(w: number, h: number, s: WatermarkSettings) {
  const diag = Math.hypot(w, h);
  const gap = Math.max(24, (diag * s.linesSpacing) / 100);
  const stroke = Math.max(1, Math.round(diag / 1400));
  const op = s.linesOpacity / 100;
  const lines: string[] = [];
  // Linhas a 45°: x - y = c (descendo) e x + y = c (subindo)
  for (let c = -h; c <= w; c += gap) lines.push(`<line x1="${c}" y1="0" x2="${c + h}" y2="${h}"/>`);
  if (s.linesCross) for (let c = 0; c <= w + h; c += gap) lines.push(`<line x1="${c}" y1="0" x2="${c - h}" y2="${h}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<g stroke="#000" stroke-opacity="${(op * 0.35).toFixed(3)}" stroke-width="${stroke + 1}" transform="translate(0.6 0.6)">${lines.join("")}</g>
<g stroke="#fff" stroke-opacity="${op.toFixed(3)}" stroke-width="${stroke}">${lines.join("")}</g>
</svg>`;
}

/** Aplica a marca d'água conforme a configuração (logo ao centro + linhas). */
export async function watermark(
  input: Buffer,
  s: WatermarkSettings = WATERMARK_DEFAULTS,
  logo: WatermarkLogo = { kind: "padrao" },
  /** Maior lado da foto entregue (site público); sem valor = tamanho original */
  maxPx?: number,
): Promise<{ data: Buffer; type: string }> {
  if (maxPx) {
    input = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true })
      .toBuffer();
  }
  // Reprocessada sem metadados: GPS, data e aparelho da foto não saem para o site
  const img = sharp(input, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  // Orientação EXIF 5–8 troca largura e altura
  const swap = (meta.orientation ?? 1) >= 5;
  const w = (swap ? meta.height : meta.width) ?? 1200;
  const h = (swap ? meta.width : meta.height) ?? 800;
  const layers: sharp.OverlayOptions[] = [];
  if (s.lines) {
    layers.push({ input: Buffer.from(linesSvg(w, h, s)), top: 0, left: 0 });
  }
  if (s.logo && logo) {
    const ratio = logo.kind === "empresa" ? logo.ratio : 230 / 300;
    const markW = Math.max(100, Math.round(Math.min((w * s.logoSize) / 100, (h * 0.6) / ratio)));
    const svg =
      logo.kind === "empresa"
        ? customLogoSvg(logo.png, logo.ratio, markW, s.logoOpacity / 100)
        : logoSvg(markW, s.logoOpacity / 100);
    const mark = await sharp(Buffer.from(svg)).png().toBuffer();
    layers.push({ input: mark, gravity: "centre" });
  }
  const out = layers.length ? img.composite(layers) : img;
  if (meta.format === "png") return { data: await out.png().toBuffer(), type: "image/png" };
  if (meta.format === "webp") return { data: await out.webp({ quality: 82 }).toBuffer(), type: "image/webp" };
  return { data: await out.jpeg({ quality: 84, mozjpeg: true }).toBuffer(), type: "image/jpeg" };
}
