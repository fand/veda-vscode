/*{
  "IMPORTED": {
    "video": { "PATH": "videos/1.mp4" }
    // "video": { "PATH": "/Users/amagi/Movies/vj/amagi/distorted.mp4" }
    // "video": { "PATH": "~/Movies/vj/amagi/yellow_spiral.mp4" }
  }
}*/
#version 410
// Author: @amagitakayosi

precision highp float;
uniform vec2 mouse;
uniform vec2 resolution;
uniform float time;
uniform float volume;
uniform sampler2D video;

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

vec3 hueRot(vec3 rgb, float t) {
    vec3 hsv = rgb2hsv(rgb);
    hsv.x += t;
    return hsv2rgb(hsv);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  vec4 c = vec4(0);

  if (fract(time) < .5) {
      c = texture(video, uv);
  } else {
      c = texture(video, fract(uv * 2.));
  }

  c.rgb = hueRot(c.rgb, time * .3);

  fragColor = c;
}
