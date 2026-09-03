(function() {
  const canvas = document.getElementById('shader-canvas-hero');
  if (!canvas) return;

  function syncSize() {
    const w = canvas.clientWidth  || canvas.parentElement.clientWidth || 1280;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight || 720;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
    }
  }
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(syncSize).observe(canvas);
    if (canvas.parentElement) new ResizeObserver(syncSize).observe(canvas.parentElement);
  }
  syncSize();
  window.addEventListener('resize', syncSize);

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    canvas.style.display = 'none';
    return;
  }
  const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
  const fs = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
    vec2 uv = v_texCoord;
    vec2 mouse = u_mouse / u_resolution;
    float n = noise(uv * 3.0 + u_time * 0.2);
    n += 0.5 * noise(uv * 6.0 - u_time * 0.1);
    float dist = distance(uv, mouse);
    float glow = smoothstep(0.5, 0.0, dist) * 0.2;
    vec3 color1 = vec3(0.05, 0.05, 0.05);
    vec3 color2 = vec3(0.9, 0.0, 0.07);
    vec3 finalColor = mix(color1, color2, n * 0.4 + glow);
    float swirls = smoothstep(0.4, 0.6, noise(uv * 10.0 + u_time * 0.3));
    finalColor = mix(finalColor, vec3(0.0), swirls * 0.2);
    gl_FragColor = vec4(finalColor, 1.0);
}`;
  function cs(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('shader compile', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  const vsS = cs(gl.VERTEX_SHADER, vs);
  const fsS = cs(gl.FRAGMENT_SHADER, fs);
  if (!vsS || !fsS) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vsS);
  gl.attachShader(prog, fsS);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');

  let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
  let isMobile = window.matchMedia('(max-width: 768px)').matches;
  window.addEventListener('mousemove', (event) => {
    if (isMobile) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = 1.0 - (event.clientY - rect.top) / rect.height;
      mouse.x = nx * canvas.width;
      mouse.y = ny * canvas.height;
    }
  });
  // subtle auto-move on mobile
  let autoT = 0;
  function render(t) {
    if (typeof ResizeObserver === 'undefined') syncSize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (uTime) gl.uniform1f(uTime, t * 0.001);
    if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    if (isMobile) {
      autoT += 0.003;
      mouse.x = canvas.width * (0.5 + Math.sin(autoT) * 0.15);
      mouse.y = canvas.height * (0.5 + Math.cos(autoT*0.7) * 0.15);
    }
    if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  render(0);
})();
