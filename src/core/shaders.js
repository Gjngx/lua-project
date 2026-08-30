export const distortionVertex = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
    }
`;

export const objectFitFragment = `
    precision highp float;
    uniform float uCurlStrength;
    uniform vec4 uRect;
    uniform vec2 uViewportPx;
    uniform sampler2D tMap;
    varying vec2 vUv;

    vec2 applyCurl(vec2 screenUv) {
        float centered = 2.0 * screenUv.y - 1.0;
        float profile = 1.0 - sqrt(max(0.0, 1.0 - centered * centered));
        float uvScale = 1.0 - profile * uCurlStrength;
        float distortedX = (screenUv.x - 0.5) * uvScale + 0.5;
        return vec2(distortedX, screenUv.y);
    }

    float edgeAaMask(vec2 uv, vec2 aaRef) {
        vec2 edgeDist = min(uv, 1.0 - uv);
        float xClip = smoothstep(0.0, aaRef.x, edgeDist.x);
        float yClip = smoothstep(0.0, aaRef.y, edgeDist.y);
        return xClip * yClip;
    }

    void main() {
        vec2 distortedScreenUv = applyCurl(vUv);
        vec2 localUv = (distortedScreenUv - uRect.xy) / uRect.zw;
        // Avoid fwidth here: raw GLSL 1 shaders require the derivatives
        // extension on some WebGL implementations. One screen pixel in the
        // image's local UV space gives the same edge AA without that extension.
        vec2 aa = 1.5 / max(uRect.zw * uViewportPx, vec2(1.0));
        vec4 texColor = texture2D(tMap, clamp(localUv, 0.0, 1.0));
        float alpha = texColor.a * edgeAaMask(localUv, aa);
        if (alpha < 0.001) discard;

        gl_FragColor = vec4(texColor.rgb, alpha);
    }
`;
