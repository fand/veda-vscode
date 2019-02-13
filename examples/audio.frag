#version 410
// Rainbow Amagi
// Author: @amagitakayosi

precision highp float;
uniform vec2 mouse;
uniform vec2 resolution;
uniform float time;
uniform float volume;

#define PI 3.141593
out vec4 fragColor;

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

float amagi(vec2 p) {
  return (
    smoothstep(1., .98, length(p)) *
    smoothstep(.98, 1., length(p * 1.3 + vec2(0., -.32))) +
    smoothstep(1., .98, length(p * 1.7 + vec2(0., -.68))) *
    smoothstep(.98, 1., length(p * 2.0 + vec2(0., -.60)))
  );
}

vec2 rot(vec2 uv, float t) {
    float c = cos(t), s = sin(t);
    return mat2(c, -s, s, c) * uv;
}

void main() {
  vec2 p = gl_FragCoord.xy / resolution;
  p -= .5;
  p.x *= resolution.x / resolution.y;
  p *= 3. * (1. + volume);

  vec4 c = vec4(1);

  c -= smoothstep(1.2, .8, length(p + vec2(0, .08))) *.3;

  float l = length(p);
//  c = mix(c, cursor(p), smoothstep(10., .0,  l));
  c = cursor(p);
  c += amagi(p);

  c = mix(vec4(0, 0, 0, 1), c, clamp(c.a, 0., 1.));

  fragColor = c;
}
