/**
 * @module og/shaders/drawnode
 */

"use strict";

import { Program } from "../webgl/Program.js";
import * as atmos from "../shaders/atmos.js";

// REMEMBER!
// src*(1)+dest*(1-src.alpha)
// glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
// src*(src.alpha)+dest*(1-src.alpha)
// glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);


const NIGHT = `const vec3 nightStep = 10.0 * vec3(0.58, 0.48, 0.25);`;

const DEF_BLEND = `#define blend(DEST, SAMPLER, OFFSET, OPACITY) \
                    src = texture( SAMPLER, OFFSET.xy + vTextureCoord.xy * OFFSET.zw );\
                    DEST = DEST * (1.0 - src.a * OPACITY) + src * OPACITY;`;

const DEF_BLEND_WEBGL1 = `#define blend(DEST, SAMPLER, OFFSET, OPACITY) \
                            src = texture2D( SAMPLER, OFFSET.xy + vTextureCoord.xy * OFFSET.zw ); \
                            DEST = DEST * (1.0 - src.a * OPACITY) + src * OPACITY;`;

const DEF_BLEND_PICKING = `#define blendPicking(DEST, OFFSET, SAMPLER, MASK, COLOR, OPACITY) \
    tc = OFFSET.xy + vTextureCoord.xy * OFFSET.zw; \
    t = texture2D(SAMPLER, tc); \
    p = texture2D(MASK, tc); \
    DEST = mix(DEST, vec4(max(COLOR.rgb, p.rgb), OPACITY), (t.a == 0.0 ? 0.0 : 1.0) * COLOR.a);`


const SLICE_SIZE = 4;

export function drawnode_screen_nl() {
    return new Program("drawnode_screen_nl", {
        uniforms: {
            projectionMatrix: "mat4",
            viewMatrix: "mat4",
            eyePositionHigh: "vec3",
            eyePositionLow: "vec3",
            samplerCount: "int",
            tileOffsetArr: "vec4",
            layerOpacityArr: "float",
            samplerArr: "sampler2darray",
            defaultTexture: "sampler2d",
            height: "float"
        }, attributes: {
            aVertexPositionHigh: "vec3", aVertexPositionLow: "vec3", aTextureCoord: "vec2"
        },

        vertexShader: `attribute vec3 aVertexPositionHigh;
            attribute vec3 aVertexPositionLow;
            attribute vec2 aTextureCoord;

            uniform mat4 projectionMatrix;
            uniform mat4 viewMatrix;
            uniform vec3 eyePositionHigh;
            uniform vec3 eyePositionLow;
            uniform float height;

            varying vec2 vTextureCoord;

            void main(void) {
                vTextureCoord = aTextureCoord;

                vec3 aVertexPosition = aVertexPositionHigh + aVertexPositionLow;
                vec3 highDiff = aVertexPositionHigh - eyePositionHigh;
                vec3 lowDiff = aVertexPositionLow + normalize(aVertexPosition) * height - eyePositionLow;

                mat4 viewMatrixRTE = viewMatrix;
                viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0);

                gl_Position = projectionMatrix * viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);
            }`,

        fragmentShader: `precision highp float;
            #define SLICE_SIZE ${SLICE_SIZE + 1}
            uniform vec4 tileOffsetArr[SLICE_SIZE];
            uniform float layerOpacityArr[SLICE_SIZE];
            uniform sampler2D defaultTexture;
            uniform sampler2D samplerArr[SLICE_SIZE];
            uniform int samplerCount;
            varying vec2 vTextureCoord;

            ${DEF_BLEND_WEBGL1}

            void main(void) {
                gl_FragColor = texture2D( defaultTexture, vTextureCoord );
                if( samplerCount == 0 ) return;

                vec4 src;

                blend(gl_FragColor, samplerArr[0], tileOffsetArr[0], layerOpacityArr[0]);
                if( samplerCount == 1 ) return;

                blend(gl_FragColor, samplerArr[1], tileOffsetArr[1], layerOpacityArr[1]);
                if( samplerCount == 2 ) return;

                blend(gl_FragColor, samplerArr[2], tileOffsetArr[2], layerOpacityArr[2]);
                if( samplerCount == 3 ) return;

                blend(gl_FragColor, samplerArr[3], tileOffsetArr[3], layerOpacityArr[3]);
                if( samplerCount == 4 ) return;

                blend(gl_FragColor, samplerArr[4], tileOffsetArr[4], layerOpacityArr[4]);
            }`
    });
}

export function drawnode_screen_wl() {
    return new Program("drawnode_screen_wl", {
        uniforms: {
            projectionMatrix: "mat4",
            viewMatrix: "mat4",
            eyePositionHigh: "vec3",
            eyePositionLow: "vec3",
            height: "float",

            uGlobalTextureCoord: "vec4",
            uNormalMapBias: "vec3",

            samplerCount: "int",
            tileOffsetArr: "vec4",
            layerOpacityArr: "float",
            samplerArr: "sampler2darray",
            defaultTexture: "sampler2d",
            normalMatrix: "mat3",
            uNormalMap: "sampler2d",
            nightTexture: "sampler2d",
            specularTexture: "sampler2d",
            lightsPositions: "vec4",
            diffuse: "vec3",
            ambient: "vec3",
            specular: "vec4"
        }, attributes: {
            aVertexPositionHigh: "vec3", aVertexPositionLow: "vec3", aTextureCoord: "vec2"
        },

        vertexShader: `attribute vec3 aVertexPositionHigh;
            attribute vec3 aVertexPositionLow;
            attribute vec2 aTextureCoord;

            uniform mat4 projectionMatrix;
            uniform mat4 viewMatrix;
            uniform float height;
            uniform vec4 uGlobalTextureCoord;
            uniform vec3 uNormalMapBias;
            uniform vec3 eyePositionHigh;
            uniform vec3 eyePositionLow;

            varying vec4 vTextureCoord;
            varying vec2 vGlobalTextureCoord;
            varying vec4 v_vertex;
            varying float v_height;           

            void main(void) {

                vec3 aVertexPosition = aVertexPositionHigh + aVertexPositionLow;
                vec3 highDiff = aVertexPositionHigh - eyePositionHigh;
                vec3 lowDiff = aVertexPositionLow + normalize(aVertexPosition) * height - eyePositionLow;

                mat4 viewMatrixRTE = viewMatrix;
                viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0);

                v_height = height;
                vec3 heightVertex = aVertexPosition + normalize(aVertexPosition) * height;
                v_vertex = viewMatrix * vec4(heightVertex, 1.0);
                vTextureCoord.xy = aTextureCoord;
                vGlobalTextureCoord = uGlobalTextureCoord.xy + (uGlobalTextureCoord.zw - uGlobalTextureCoord.xy) * aTextureCoord;
                vTextureCoord.zw = uNormalMapBias.z * ( aTextureCoord + uNormalMapBias.xy );
                gl_Position = projectionMatrix * viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);
            }`,

        fragmentShader: `precision highp float;

            #define MAX_POINT_LIGHTS 1
            #define SLICE_SIZE ${SLICE_SIZE + 1}

            uniform vec3 diffuse;
            uniform vec3 ambient;
            uniform vec4 specular;

            uniform sampler2D uNormalMap;
            uniform vec4 lightsPositions[MAX_POINT_LIGHTS];
            uniform mat3 normalMatrix;
            uniform sampler2D nightTexture;
            uniform sampler2D specularTexture;

            uniform vec4 tileOffsetArr[SLICE_SIZE];
            uniform float layerOpacityArr[SLICE_SIZE];

            uniform sampler2D defaultTexture;
            uniform sampler2D samplerArr[SLICE_SIZE];
            uniform int samplerCount;

            varying vec4 vTextureCoord;
            varying vec2 vGlobalTextureCoord;
            varying vec4 v_vertex;
            varying float v_height;

            ${NIGHT}

            ${DEF_BLEND_WEBGL1}

            float shininess;
            float reflection;
            float diffuseLightWeighting;
            vec3 night;

            void main(void) {
            
                float overGround = 1.0 - step(0.1, v_height);
                vec3 normal = normalize(normalMatrix * ((texture2D(uNormalMap, vTextureCoord.zw).rgb - 0.5) * 2.0));
                vec3 lightDir = normalize(lightsPositions[0].xyz - v_vertex.xyz * lightsPositions[0].w);
                vec3 eyeDirection = normalize(-v_vertex.xyz);
                vec3 reflectionDirection = reflect(-lightDir, normal);
                vec4 nightImageColor = texture2D( nightTexture, vGlobalTextureCoord.st );
                shininess = texture2D( specularTexture, vGlobalTextureCoord.st ).r * 255.0 * overGround;
                reflection = max( dot(reflectionDirection, eyeDirection), 0.0);
                diffuseLightWeighting = max(dot(normal, lightDir), 0.0);
                night = nightStep * (.18 - diffuseLightWeighting * 3.0) * nightImageColor.rgb;
                night *= overGround * step(0.0, night);

                vec3 spec = specular.rgb * pow( reflection, specular.w) * shininess;
                vec4 lightWeighting = vec4(ambient + diffuse * diffuseLightWeighting + spec + night, 1.0);

                gl_FragColor = texture2D( defaultTexture, vTextureCoord.xy );
                if( samplerCount == 0 ) {
                    gl_FragColor *= lightWeighting;
                    return;
                }
    
                vec4 src;

                blend(gl_FragColor, samplerArr[0], tileOffsetArr[0], layerOpacityArr[0]);
                if( samplerCount == 1 ) {
                    gl_FragColor *= lightWeighting;
                    return;
                }

                blend(gl_FragColor, samplerArr[1], tileOffsetArr[1], layerOpacityArr[1]);
                if( samplerCount == 2 ) {
                    gl_FragColor *= lightWeighting;
                    return;
                }

                blend(gl_FragColor, samplerArr[2], tileOffsetArr[2], layerOpacityArr[2]);
                if( samplerCount == 3 ) {
                    gl_FragColor *= lightWeighting;
                    return;
                }

                blend(gl_FragColor, samplerArr[3], tileOffsetArr[3], layerOpacityArr[3]);
                if( samplerCount == 4 ) {
                    gl_FragColor *= lightWeighting;
                    return;
                }

                blend(gl_FragColor, samplerArr[4], tileOffsetArr[4], layerOpacityArr[4]);
                gl_FragColor *= lightWeighting;
            }`
    });
}

// export function drawnode_screen_wl_webgl2() {
//     return new Program("drawnode_screen_wl", {
//         uniforms: {
//             projectionMatrix: "mat4",
//             viewMatrix: "mat4",
//             eyePositionHigh: "vec3",
//             eyePositionLow: "vec3",
//             height: "float",
//
//             uGlobalTextureCoord: "vec4",
//             uNormalMapBias: "vec3",
//
//             samplerCount: "int",
//             tileOffsetArr: "vec4",
//             layerOpacityArr: "float",
//             samplerArr: "sampler2darray",
//             defaultTexture: "sampler2d",
//             normalMatrix: "mat3",
//             uNormalMap: "sampler2d",
//             nightTexture: "sampler2d",
//             specularTexture: "sampler2d",
//             lightsPositions: "vec4",
//             diffuse: "vec3",
//             ambient: "vec3",
//             specular: "vec4"
//         },
//         attributes: {
//             aVertexPositionHigh: "vec3",
//             aVertexPositionLow: "vec3",
//             aTextureCoord: "vec2"
//         },
//
//         vertexShader: `#version 300 es
//
//             in vec3 aVertexPositionHigh;
//             in vec3 aVertexPositionLow;
//             in vec2 aTextureCoord;
//
//             uniform mat4 projectionMatrix;
//             uniform mat4 viewMatrix;
//             uniform float height;
//             uniform vec4 uGlobalTextureCoord;
//             uniform vec3 uNormalMapBias;
//             uniform vec3 eyePositionHigh;
//             uniform vec3 eyePositionLow;
//
//             out vec4 vTextureCoord;
//             out vec2 vGlobalTextureCoord;
//             out vec4 v_vertex;
//             out float v_height;
//
//             void main(void) {
//
//                 vec3 aVertexPosition = aVertexPositionHigh + aVertexPositionLow;
//                 vec3 highDiff = aVertexPositionHigh - eyePositionHigh;
//                 vec3 lowDiff = aVertexPositionLow + normalize(aVertexPosition) * height - eyePositionLow;
//
//                 mat4 viewMatrixRTE = viewMatrix;
//                 viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0);
//
//                 v_height = height;
//                 vec3 heightVertex = aVertexPosition + normalize(aVertexPosition) * height;
//                 v_vertex = viewMatrix * vec4(heightVertex, 1.0);
//                 vTextureCoord.xy = aTextureCoord;
//                 vGlobalTextureCoord = uGlobalTextureCoord.xy + (uGlobalTextureCoord.zw - uGlobalTextureCoord.xy) * aTextureCoord;
//                 vTextureCoord.zw = uNormalMapBias.z * ( aTextureCoord + uNormalMapBias.xy );
//                 gl_Position = projectionMatrix * viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);
//             }`,
//
//         fragmentShader: `#version 300 es
//
//             precision highp float;
//
//             #define MAX_POINT_LIGHTS 1
//             #define SLICE_SIZE ${SLICE_SIZE + 1}
//
//             uniform vec3 diffuse;
//             uniform vec3 ambient;
//             uniform vec4 specular;
//
//             uniform sampler2D uNormalMap;
//             uniform vec4 lightsPositions[MAX_POINT_LIGHTS];
//             uniform mat3 normalMatrix;
//             uniform sampler2D nightTexture;
//             uniform sampler2D specularTexture;
//
//             uniform vec4 tileOffsetArr[SLICE_SIZE];
//             uniform float layerOpacityArr[SLICE_SIZE];
//
//             uniform sampler2D defaultTexture;
//             uniform sampler2D samplerArr[SLICE_SIZE];
//             uniform int samplerCount;
//
//             in vec4 vTextureCoord;
//             in vec2 vGlobalTextureCoord;
//             in vec4 v_vertex;
//             in float v_height;
//
//             float shininess;
//             float reflection;
//             float diffuseLightWeighting;
//             vec3 night;
//
//             layout(location = 0) out vec4 fragColor;
//
//             ${NIGHT}
//
//             ${DEF_BLEND}
//
//             void main(void) {
//
//                 float overGround = 1.0 - step(0.1, v_height);
//                 vec3 normal = normalize(normalMatrix * ((texture(uNormalMap, vTextureCoord.zw).rgb - 0.5) * 2.0));
//                 vec3 lightDir = normalize(lightsPositions[0].xyz - v_vertex.xyz * lightsPositions[0].w);
//                 vec3 eyeDirection = normalize(-v_vertex.xyz);
//                 vec3 reflectionDirection = reflect(-lightDir, normal);
//                 vec4 nightImageColor = texture( nightTexture, vGlobalTextureCoord.st );
//
//                 shininess = texture( specularTexture, vGlobalTextureCoord.st ).r * 255.0 * overGround;
//                 reflection = max( dot(reflectionDirection, eyeDirection), 0.0);
//                 diffuseLightWeighting = max(dot(normal, lightDir), 0.0);
//                 night = nightStep * (.18 - diffuseLightWeighting * 3.0) * nightImageColor.rgb;
//                 night *= overGround * step(0.0, night);
//
//                 vec3 spec = specular.rgb * pow( reflection, specular.w) * shininess;
//                 vec4 lightWeighting = vec4(ambient + diffuse * diffuseLightWeighting + spec + night, 1.0);
//
//                 fragColor = texture( defaultTexture, vTextureCoord.xy );
//                 if( samplerCount == 0 ) {
//                     fragColor *= lightWeighting;
//                     return;
//                 }
//
//                 vec4 src;
//
//                 blend(fragColor, samplerArr[0], tileOffsetArr[0], layerOpacityArr[0]);
//                 if( samplerCount == 1 ) {
//                     fragColor *= lightWeighting;
//                     return;
//                 }
//
//                 blend(fragColor, samplerArr[1], tileOffsetArr[1], layerOpacityArr[1]);
//                 if( samplerCount == 2 ) {
//                     fragColor *= lightWeighting;
//                     return;
//                 }
//
//                 blend(fragColor, samplerArr[2], tileOffsetArr[2], layerOpacityArr[2]);
//                 if( samplerCount == 3 ) {
//                     fragColor *= lightWeighting;
//                     return;
//                 }
//
//                 blend(fragColor, samplerArr[3], tileOffsetArr[3], layerOpacityArr[3]);
//                 if( samplerCount == 4 ) {
//                     fragColor *= lightWeighting;
//                     return;
//                 }
//
//                 blend(fragColor, samplerArr[4], tileOffsetArr[4], layerOpacityArr[4]);
//                 fragColor *= lightWeighting;
//             }`
//     });
// }

export function drawnode_screen_wl_webgl2() {
    return new Program("drawnode_screen_wl", {
        uniforms: {
            projectionMatrix: "mat4",
            viewMatrix: "mat4",
            eyePositionHigh: "vec3",
            eyePositionLow: "vec3",
            height: "float",

            uGlobalTextureCoord: "vec4",
            uNormalMapBias: "vec3",

            samplerCount: "int",
            tileOffsetArr: "vec4",
            layerOpacityArr: "float",
            samplerArr: "sampler2darray",
            defaultTexture: "sampler2d",
            //normalMatrix: "mat3",
            uNormalMap: "sampler2d",
            nightTexture: "sampler2d",
            specularTexture: "sampler2d",
            lightsPositions: "vec3",
            diffuse: "vec3",
            ambient: "vec3",
            specular: "vec4",

            transmittanceTexture: "sampler2D",
            scatteringTexture: "sampler2D",
            camHeight: "float",
            //sunPos: "vec3"
        }, attributes: {
            aVertexPositionHigh: "vec3",
            aVertexPositionLow: "vec3",
            aTextureCoord: "vec2"
        },

        vertexShader:
            `#version 300 es

            in vec3 aVertexPositionHigh;
            in vec3 aVertexPositionLow;
            in vec2 aTextureCoord;

            uniform mat4 projectionMatrix;
            uniform mat4 viewMatrix;
            uniform float height;
            uniform vec4 uGlobalTextureCoord;
            uniform vec3 uNormalMapBias;
            uniform vec3 eyePositionHigh;
            uniform vec3 eyePositionLow;

            out vec4 vTextureCoord;
            out vec2 vGlobalTextureCoord;
            out vec3 v_vertex;
            out float v_height;
            out vec3 cameraPosition;

            void main(void) {

                vec3 aVertexPosition = aVertexPositionHigh + aVertexPositionLow;
                
                cameraPosition = eyePositionHigh + eyePositionLow;
                
                vec3 highDiff = aVertexPositionHigh - eyePositionHigh;
                vec3 lowDiff = aVertexPositionLow + normalize(aVertexPosition) * height - eyePositionLow;

                mat4 viewMatrixRTE = viewMatrix;
                viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0);

                v_height = height;
                v_vertex = aVertexPosition + normalize(aVertexPosition) * height;
                vTextureCoord.xy = aTextureCoord;
                vGlobalTextureCoord = uGlobalTextureCoord.xy + (uGlobalTextureCoord.zw - uGlobalTextureCoord.xy) * aTextureCoord;
                vTextureCoord.zw = uNormalMapBias.z * ( aTextureCoord + uNormalMapBias.xy );
                gl_Position = projectionMatrix * viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);
            }`,

        fragmentShader: `#version 300 es

            precision highp float;
            
            #define MAX_POINT_LIGHTS 1
            #define SLICE_SIZE ${SLICE_SIZE + 1}

            uniform vec3 diffuse;
            uniform vec3 ambient;
            uniform vec4 specular;

            uniform sampler2D uNormalMap;
            uniform vec3 lightsPositions[MAX_POINT_LIGHTS];
            uniform sampler2D nightTexture;
            uniform sampler2D specularTexture;

            uniform sampler2D transmittanceTexture;
            uniform sampler2D scatteringTexture;

            uniform vec4 tileOffsetArr[SLICE_SIZE];
            uniform float layerOpacityArr[SLICE_SIZE];

            uniform sampler2D defaultTexture;
            uniform sampler2D samplerArr[SLICE_SIZE];
            uniform int samplerCount;
                
            uniform float camHeight;

            in vec4 vTextureCoord;
            in vec2 vGlobalTextureCoord;
            in vec3 v_vertex;
            in float v_height;

            vec3 sunPos;
            in vec3 cameraPosition;

            layout(location = 0) out vec4 diffuseColor;

            ${NIGHT}

            ${DEF_BLEND}
            
            ${atmos.COMMON}
            
            const float ATMOS_OPACITY_MAX = 1.0;
            const float ATMOS_OPACITY_MIN = 0.41;
            
            vec3 transmittanceFromTexture(float height, float angle) 
            {
                float u = (angle + 1.0) * 0.5;
                float v = height / ATMOS_HEIGHT;
                return texture(transmittanceTexture, vec2(u, v)).xyz;
            }

            vec3 multipleScatteringContributionFromTexture(float height, float angle) 
            {
                float u = (angle + 1.0) * 0.5;
                float v = height / ATMOS_HEIGHT;
                return texture(scatteringTexture, vec2(u, v)).xyz;
            }
            
            void getSunIlluminance(in vec3 point, in vec3 lightDir, out vec3 sunIlluminance)
            {
                //     float r = length(point);
                //     float mu_s = dot(point, sun_direction) / r;
                //     float height = r - BOTTOM_RADIUS;
                
                float mu_s = dot(normalize(point), lightDir);
                float height = length(point) - BOTTOM_RADIUS;
                sunIlluminance = SUN_INTENSITY * transmittanceFromTexture(height, mu_s);
            }
           
            void atmosGroundColor(out vec4 fragColor, in vec3 normal, out vec3 sunIlluminance)
            {
                vec3 scale = vec3(BOTTOM_RADIUS) / bottomRadii;
                                                                                                                                
                vec3 rayDirection = normalize(v_vertex - cameraPosition);
                vec3 lightDir = normalize(sunPos);
                
                rayDirection = normalize(rayDirection * scale);
                vec3 camPos = cameraPosition * scale;
                lightDir = normalize(lightDir * scale);
            
                vec3 light = vec3(0.0);
                vec3 transmittanceFromCameraToSpace = vec3(1.0);
                float offset = 0.0;
                float distanceToSpace = 0.0;
                
                intersectSphere(camPos, rayDirection, TOP_RADIUS, offset, distanceToSpace);
            
                vec3 rayOrigin = camPos;
                
                // above atmosphere
                if (offset > 0.0) 
                {
                    // intersection of camera ray with atmosphere
                    rayOrigin += rayDirection * offset;
                }
                
                float height = length(rayOrigin) - BOTTOM_RADIUS;
                float rayAngle = dot(rayOrigin, rayDirection) / length(rayOrigin);
                bool cameraBelow = rayAngle < 0.0;
                
                transmittanceFromCameraToSpace = transmittanceFromTexture(height, cameraBelow ? -rayAngle : rayAngle);
                
                float phaseAngle = dot(lightDir, rayDirection);
                float rayleighPhase = rayleighPhase(phaseAngle);
                float miePhase = miePhase(phaseAngle);
                
                float distanceToGround = 0.0;
                
                bool hitGround = intersectSphere(camPos, rayDirection, BOTTOM_RADIUS, distanceToGround) && distanceToGround > 0.0;                
                
                // Fix black dots on the edge of atmosphere                             
                if(camHeight < 700000.0 || !hitGround)
                {                          
                    distanceToGround = distance(camPos, v_vertex * scale);
                }
                                                                
                float segmentLength = (distanceToGround - max(offset, 0.0)) / float(SAMPLE_COUNT);
                
                float t = segmentLength * 0.5;
                
                vec3 transmittanceCamera; 
                vec3 transmittanceLight; 
                
                for (int i = 0; i < SAMPLE_COUNT; i++) 
                {
                    vec3 position = rayOrigin + t * rayDirection;
                    float height = length(position) - BOTTOM_RADIUS;
                    vec3 up = position / length(position);
                    float rayAngle = dot(up, rayDirection);
                    float lightAngle = dot(up, lightDir);
                    
                    //shadow is ommitted because it can create banding artifacts with low sample counts
                    //float distanceToGround;
                    //float shadow = intersectSphere(position, lightDir, BOTTOM_RADIUS, distanceToGround) && distanceToGround >= 0.0 ? 0.0 : 1.0;
                             
                    float shadow = 1.0;
                    vec3 transmittanceToSpace = transmittanceFromTexture(height, cameraBelow ? -rayAngle : rayAngle);
                    transmittanceCamera = cameraBelow ? (transmittanceToSpace / transmittanceFromCameraToSpace) : (transmittanceFromCameraToSpace / transmittanceToSpace);
                    transmittanceLight = transmittanceFromTexture(height, lightAngle);
                    vec2 opticalDensity = exp(-height / vec2(rayleighScaleHeight, mieScaleHeight));
                    vec3 scatteredLight = transmittanceLight * (rayleighScatteringCoefficient * opticalDensity.x * rayleighPhase + mieScatteringCoefficient * opticalDensity.y * miePhase);
                    scatteredLight += multipleScatteringContributionFromTexture(height, lightAngle) * (rayleighScatteringCoefficient * opticalDensity.x + mieScatteringCoefficient * opticalDensity.y);  
                    light += shadow * transmittanceCamera * scatteredLight * segmentLength;
                    t += segmentLength;
                }
                
                light *= SUN_INTENSITY;
        
                vec3 hitPoint = camPos + rayDirection * distanceToGround;
                vec3 up = normalize(hitPoint);
                float diffuseAngle = max(dot(up, lightDir), 0.0);                
                                
                float lightAngle = dot(normal, lightDir);
                float groundAlbedo = 0.05;
                vec3 tA = transmittanceCamera * (groundAlbedo / PI) * SUN_INTENSITY;                                               
                vec3 scatteringLight = multipleScatteringContributionFromTexture(height, lightAngle);
                vec3 diffuseTransmittanceLight = transmittanceLight * diffuseAngle;                
                light += tA * (scatteringLight + diffuseTransmittanceLight);
                
                getSunIlluminance(v_vertex * scale, lightDir, sunIlluminance);
            
                vec3 color = light;
                // tone mapping
                // float exposure = 10.0;
                // color = (1.0 - exp(color * -exposure));
                color *= 8.0;
                //color = aces(color);
                  
                color = pow(color, vec3(1.0 / 2.2));
                                     
                fragColor = vec4(color, 1.0);
            }

            void main(void) {
            
                sunPos = lightsPositions[0];
                                
                vec3 texNormal = texture(uNormalMap, vTextureCoord.zw).rgb;                               
                vec3 normal = normalize((texNormal - 0.5) * 2.0);
                
                //normal = normalize(v_vertex);
                                            
                vec3 lightDir = normalize(sunPos - v_vertex);                       
                vec3 viewDir = normalize(cameraPosition - v_vertex);
                vec3 reflectionDirection = reflect(-lightDir, normal);
                vec4 nightImageColor = texture( nightTexture, vGlobalTextureCoord.st );

                float overGround = 1.0 - step(0.1, v_height);
                float shininess = texture( specularTexture, vGlobalTextureCoord.st ).r * 255.0 * overGround;
                float reflection = max( dot(reflectionDirection, viewDir), 0.0);
                float diffuseLightWeighting = max(dot(normal, lightDir), 0.0);
                
                vec3 night = nightStep * (.18 - diffuseLightWeighting * 3.0) * nightImageColor.rgb;
                night *= overGround * step(0.0, night);

                vec4 atmosColor;
                vec3 sunIlluminance;                
                atmosGroundColor(atmosColor, normal, sunIlluminance);  
                
                vec3 spec = specular.rgb * pow( reflection, specular.w) * shininess;
                vec4 lightWeighting = vec4(ambient + sunIlluminance * diffuse * diffuseLightWeighting + night * 5.0, 1.0);                             

                diffuseColor = texture( defaultTexture, vTextureCoord.xy );
                if( samplerCount == 0 ) {
                    return;
                }

                vec4 src;

                blend(diffuseColor, samplerArr[0], tileOffsetArr[0], layerOpacityArr[0]);
                if( samplerCount == 1 ) {                
                    diffuseColor *= lightWeighting;
                                        
                    float c = length(cameraPosition);
                    float maxDist = sqrt(c * c - BOTTOM_RADIUS * BOTTOM_RADIUS);
                    float minDist = c - BOTTOM_RADIUS;
                    float vertDist = distance(cameraPosition, v_vertex);
                    
                    float f = ATMOS_OPACITY_MIN + (ATMOS_OPACITY_MAX - ATMOS_OPACITY_MIN) * lerp(minDist, maxDist, vertDist);

                    diffuseColor = mix(diffuseColor, atmosColor, f) + vec4(spec, 0.0);
                    return;
                }

                blend(diffuseColor, samplerArr[1], tileOffsetArr[1], layerOpacityArr[1]);
                if( samplerCount == 2 ) {
                    diffuseColor *= lightWeighting;
                    return;
                }

                blend(diffuseColor, samplerArr[2], tileOffsetArr[2], layerOpacityArr[2]);
                if( samplerCount == 3 ) {
                    diffuseColor *= lightWeighting;
                    return;
                }

                blend(diffuseColor, samplerArr[3], tileOffsetArr[3], layerOpacityArr[3]);
                if( samplerCount == 4 ) {
                    diffuseColor *= lightWeighting;
                    return;
                }

                blend(diffuseColor, samplerArr[4], tileOffsetArr[4], layerOpacityArr[4]);
                diffuseColor *= lightWeighting;
            }`
    });
}

export function drawnode_colorPicking() {
    return new Program("drawnode_colorPicking", {
        uniforms: {
            projectionMatrix: "mat4",
            viewMatrix: "mat4",
            eyePositionHigh: "vec3",
            eyePositionLow: "vec3",
            samplerCount: "int",
            tileOffsetArr: "vec4",
            samplerArr: "sampler2darray",
            pickingMaskArr: "sampler2darray",
            pickingColorArr: "vec4",
            height: "float"
        }, attributes: {
            aVertexPositionHigh: "vec3", aVertexPositionLow: "vec3", aTextureCoord: "vec2"
        },

        vertexShader: `attribute vec3 aVertexPositionHigh;
            attribute vec3 aVertexPositionLow;
            attribute vec2 aTextureCoord;

            uniform mat4 projectionMatrix;
            uniform mat4 viewMatrix;
            uniform vec3 eyePositionHigh;
            uniform vec3 eyePositionLow;
            uniform float height;

            varying vec2 vTextureCoord;

            void main(void) {

                vec3 aVertexPosition = aVertexPositionHigh + aVertexPositionLow;
                vec3 highDiff = aVertexPositionHigh - eyePositionHigh;
                vec3 lowDiff = aVertexPositionLow + normalize(aVertexPosition) * height - eyePositionLow;

                mat4 viewMatrixRTE = viewMatrix;
                viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0);

                vTextureCoord = aTextureCoord;
                gl_Position = projectionMatrix * viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);
            }`,

        fragmentShader: `precision highp float;
            #define SLICE_SIZE ${SLICE_SIZE + 1}
            uniform vec4 tileOffsetArr[SLICE_SIZE];
            uniform vec4 pickingColorArr[SLICE_SIZE];
            uniform sampler2D samplerArr[SLICE_SIZE];
            uniform sampler2D pickingMaskArr[SLICE_SIZE];
            uniform int samplerCount;
            varying vec2 vTextureCoord;

            ${DEF_BLEND_PICKING}

            void main(void) {
                gl_FragColor = vec4(0.0);
                if( samplerCount == 0 ) return;

                vec2 tc;
                vec4 t;
                vec4 p;

                blendPicking(gl_FragColor, tileOffsetArr[0], samplerArr[0], pickingMaskArr[0], pickingColorArr[0], 1.0);
                if( samplerCount == 1 ) return;

                blendPicking(gl_FragColor, tileOffsetArr[1], samplerArr[1], pickingMaskArr[1], pickingColorArr[1], 1.0);
                if( samplerCount == 2 ) return;

                blendPicking(gl_FragColor, tileOffsetArr[2], samplerArr[2], pickingMaskArr[2], pickingColorArr[2], 1.0);
                if( samplerCount == 3 ) return;

                blendPicking(gl_FragColor, tileOffsetArr[3], samplerArr[3], pickingMaskArr[3], pickingColorArr[3], 1.0);
                if( samplerCount == 4 ) return;

                blendPicking(gl_FragColor, tileOffsetArr[4], samplerArr[4], pickingMaskArr[4], pickingColorArr[4], 1.0);
            }`
    });
}

export function drawnode_heightPicking() {
    return new Program("drawnode_heightPicking", {
        uniforms: {
            projectionMatrix: "mat4",
            viewMatrix: "mat4",
            height: "float",
            eyePositionHigh: "vec3",
            eyePositionLow: "vec3"
        }, attributes: {
            aVertexPositionHigh: "vec3", aVertexPositionLow: "vec3"
        },

        vertexShader: `attribute vec3 aVertexPositionHigh;
            attribute vec3 aVertexPositionLow;

            uniform mat4 projectionMatrix;
            uniform mat4 viewMatrix;
            uniform float height;
            uniform vec3 eyePositionHigh;
            uniform vec3 eyePositionLow;

            varying float range;

            void main(void) {

                vec3 cameraPosition = eyePositionHigh + eyePositionLow;
                vec3 aVertexPosition = aVertexPositionHigh + aVertexPositionLow;

                vec3 highDiff = aVertexPositionHigh - eyePositionHigh;
                vec3 lowDiff = aVertexPositionLow + normalize(aVertexPosition) * height - eyePositionLow;

                mat4 viewMatrixRTE = viewMatrix;
                viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0);

                range = distance(cameraPosition, aVertexPosition + normalize(aVertexPosition) * height);
                gl_Position = projectionMatrix * viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);
            }`,

        fragmentShader: `precision highp float;

            varying float range;

            vec3 encode24(highp float f) {
                float F = abs(f);
                float s = step( 0.0, -f );
                float e = floor( log2(F) );
                float m = exp2(- e) * F;
                e = floor( log2(F) + 127.0 ) + floor( log2(m) );
                return vec3(
                    ( 128.0 * s + floor( e * exp2(-1.0) ) ) / 255.0,
                    ( 128.0 * mod( e, 2.0 ) + mod( floor( m * 128.0 ), 128.0 ) ) / 255.0,
                    floor( mod( floor( m * exp2( 23.0 - 8.0) ), exp2(8.0) ) ) / 255.0);
            }

            void main(void) {
                gl_FragColor = vec4(encode24(range), 1.0);
            }`
    });
}

export function drawnode_depth() {
    return new Program("drawnode_depth", {
        uniforms: {
            projectionMatrix: "mat4",
            viewMatrix: "mat4",
            height: "float",
            eyePositionHigh: "vec3",
            eyePositionLow: "vec3",
            frustumPickingColor: "vec3"
        }, attributes: {
            aVertexPositionHigh: "vec3", aVertexPositionLow: "vec3"
        },

        vertexShader: `attribute vec3 aVertexPositionHigh;
            attribute vec3 aVertexPositionLow;

            uniform mat4 projectionMatrix;
            uniform mat4 viewMatrix;
            uniform float height;
            uniform vec3 eyePositionHigh;
            uniform vec3 eyePositionLow;

            void main(void) {

                vec3 cameraPosition = eyePositionHigh + eyePositionLow;
                vec3 aVertexPosition = aVertexPositionHigh + aVertexPositionLow;

                vec3 highDiff = aVertexPositionHigh - eyePositionHigh;
                vec3 lowDiff = aVertexPositionLow + normalize(aVertexPosition) * height - eyePositionLow;

                mat4 viewMatrixRTE = viewMatrix;
                viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0);

                gl_Position = projectionMatrix * viewMatrixRTE * vec4(highDiff + lowDiff, 1.0);
            }`,

        fragmentShader: `precision highp float;
            uniform vec3 frustumPickingColor;

            void main(void) {
                gl_FragColor = vec4(frustumPickingColor, 1.0);
            } `
    });
}
