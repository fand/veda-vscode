const gl = require('gl');
const Veda = require('vedajs');

const width = 128;
const height = 128;


var ctx = gl(width, height, { preserveDrawingBuffer: true });

const veda = new Veda({});
veda.setCanvas({
  getContext: () => ctx,
});

veda.loadFragmentShader(`
#ifdef GL_ES
precision mediump float;
#endif

#extension GL_OES_standard_derivatives : enable

precision highp float;
uniform vec2 resolution;
uniform float time;

#define PI 3.141593

//http://gamedev.stackexchange.com/questions/59797/glsl-shader-change-hue-saturation-brightness
vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float wave6(float x) {
  x = fract(x);
  return (
    smoothstep(.16, .17, x) +
    smoothstep(.33, .34, x) +
    smoothstep(.49, .50, x) +
    smoothstep(.66, .67, x) +
    smoothstep(.83, .84, x) +
    smoothstep(.99, 1.0, x)
  ) / 6.;
}

float shadow6(float x) {
  x = mod(x, 0.16666) / 0.16666;
  return smoothstep(.3, .0, x);
}

vec4 cursor(vec2 p) {
  vec4 c = vec4(1,0,0,1);
  float a = atan(p.y, p.x);

  // swirl
  float l = length(p);
  a -= l * .9 - 1.;
  a += time * 5.;

  // set hue
  vec3 hsv = rgb2hsv(vec3(1., .4, .4));
  hsv.x += wave6(a / PI / 2.);
  c.rgb = hsv2rgb(hsv);
  c.rgb -= max(0., sin(hsv.x * PI *2. -.5) *.2);

  // add subtle shadow on color gap
  c.rgb *= 1. - shadow6(a / PI / 2.) * .1;

  c *= 1. - l * l * .2;

  return c;
}

void main() {
  vec2 p = gl_FragCoord.xy / resolution;
  p -= .5;
  p.x *= resolution.x / resolution.y;
  p *= 4.;

  vec4 c = vec4(1);

  c -= smoothstep(1.2, .8, length(p + vec2(0, .08))) *.3;

  float l = length(p);
  c = mix(c, cursor(p), smoothstep(1.03, 1., l));


  gl_FragColor = c;
}
`.trim());
veda.play();


const pixels = new Uint8Array(width * height * 4);
setInterval(() => {
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
}, 3000);

