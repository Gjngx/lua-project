export const distortionVertex = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    uniform float uProgress;
    uniform vec3 distortionAxis;
    uniform vec3 rotationAxis;
    uniform float uDistortion;
    varying vec2 vUv;
    float PI = 3.141592653589793238;
    mat4 rotationMatrix(vec3 axis, float angle) {
        axis = normalize(axis);
        float s = sin(angle);
        float c = cos(angle);
        float oc = 1.0 - c;
        return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                    0.0,                                0.0,                                0.0,                                1.0);
    }
    vec3 rotate(vec3 v, vec3 axis, float angle) {
        mat4 m = rotationMatrix(axis, angle);
        return (m * vec4(v, 1.0)).xyz;
    }
    void main() {
        vUv = uv;
        float norm = 0.5;
        vec3 newpos = position;
        float offset = ( dot(distortionAxis,position) +norm/2.)/norm;
        float bend = sin(uProgress * PI) * 0.05 * uDistortion * offset; 
        float angle = (uProgress - bend) * PI; 
        newpos = rotate(newpos,rotationAxis,angle);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newpos, 1.0);
    }
`;

export const objectFitFragment = `
    precision highp float;
    uniform vec2 uImageSize;
    uniform vec2 uPlaneSize;
    uniform vec2 uDOMSize;
    uniform float uBorderRadius;
    uniform sampler2D tMap;
    varying vec2 vUv;

    // Rounded box SDF (Signed Distance Field)
    float roundedBoxSDF(vec2 p, vec2 b, float r) {
        return length(max(abs(p)-b+r, 0.0)) - r;
    }

    void main() {
        vec2 ratio = vec2(
            min((uPlaneSize.x / uPlaneSize.y) / (uImageSize.x / uImageSize.y), 1.0),
            min((uPlaneSize.y / uPlaneSize.x) / (uImageSize.y / uImageSize.x), 1.0)
        );
        vec2 uv = vec2(
            vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
            vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
        );
        
        vec4 texColor = texture2D(tMap, uv);
        
        // Tính toạ độ pixel tương đối so với tâm
        vec2 pixelPos = vUv * uDOMSize - (uDOMSize * 0.5);
        
        // Tính khoảng cách SDF theo pixel thực tế
        float distance = roundedBoxSDF(pixelPos, uDOMSize * 0.5, uBorderRadius);
        
        // Smoothstep trên 1.5 pixel để khử răng cưa mượt mà
        float alpha = 1.0 - smoothstep(0.0, 1.5, distance);
        
        gl_FragColor = vec4(texColor.rgb, texColor.a * alpha);
    }
`;
