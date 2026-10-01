precision mediump float;

attribute vec2 a_position;
attribute vec4 a_triangleColor;

varying vec4 v_triangleColor;

void main() {
	gl_Position = vec4(a_position * 2.0, 0, 1);
	v_triangleColor = a_triangleColor;
}
