/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles2.json"; // triangles file loc
// const INPUT_LIGHTS_URL = "https://ncsucgclass.github.io/prog3/lights.json"; // lights file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";
//const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog3/spheres.json"; // spheres file loc

var lightPos = new Float32Array([-0.5, 1.5, -0.5]);
var lightAmbient = new Float32Array([1.0, 1.0, 1.0]);
var lightDiffuse = new Float32Array([1.0, 1.0, 1.0]);
var lightSpecular = new Float32Array([1.0, 1.0, 1.0]);

var Eye = new vec4.fromValues(0.5, 0.5, -0.5, 1.0); // default eye position in world space
// var Eye = new vec4.fromValues(0,0,0,1.0);
var lookAt = vec3.fromValues(0, 0, 1); // The point the camera is looking at (default: origin)
var lookUp = vec3.fromValues(0, 1, 0); // The up vector (default: positive Y-axis as up)

var canvasWidth, canvasHeight;

var shaderProgram;

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!

var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize; // the number of indices in the triangle buffer

var vertexBuffer; // this contains vertex coordinates in triples
var modelIndicesBuffer; // this contains the model index for each vertex
var normalBuffer; // this contains all the vertex normal vectors
var ambientColorBuffer; // this contains ambient color values in triples
var diffuseColorBuffer; // this contains diffuse color values in triples
var specularColorBuffer; // this contains specular color values in triples
var specularPowerBuffer; // this contains specular shiniess value

var vertexPositionAttrib; // where to put position for vertex shader
var modelIndicesAttrib; // where to put model index for vertex
var vertexNormalAttrib; // where to put normals for vertex shader
var ambientColorAttrib; // where to put ambient color for vertex shader
var diffuseColorAttrib; // where to put diffuse color for vertex shader
var specularColorAttrib; //where to put specular color for vertex shader
var specularPowerAttrib; //where to put specular shiniess for vertex shader


var modelMatrices = []; // list of model matrices
var scaleMatrices = []; // list of scale matrices
var translationMatrices = []; // list of translation matrices
var rotationMatrices = []; // list of rotation matrices
var modelCenters = []; // array of model centers

var selected = false; // whether a model is selected or not
var selectedModelIdx = 0; // current model index
var numModels; // max number of models 

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url, descr) {
    try {
        if ((typeof (url) !== "string") || (typeof (descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET", url, false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now() - startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open " + descr + " file!";
            else
                return JSON.parse(httpReq.response);
        } // end if good params
    } // end try    

    catch (e) {
        console.log(e);
        return (String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    canvasWidth = canvas.width;
    canvasHeight = canvas.height;

    try {
        if (gl == null) {
            throw "unable to create gl context -- is your browser gl ready?";
        } else {
            gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
            gl.clearDepth(1.0); // use max when we clear the depth buffer
            gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
        }
    } // end try

    catch (e) {
        console.log(e);
    } // end catch

} // end setupWebGL

function calculateTriangleCenter(vertex1, vertex2, vertex3) {
    var centerX = (vertex1[0] + vertex2[0] + vertex3[0]) / 3;
    var centerY = (vertex1[1] + vertex2[1] + vertex3[1]) / 3;
    var centerZ = (vertex1[2] + vertex2[2] + vertex3[2]) / 3;
    return vec3.fromValues(centerX, centerY, centerZ);
}

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles");
    if (inputTriangles != String.null) {
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var coordArray = []; // 1D array of vertex coords for WebGL
        var normalArray = []; // 1D array of normal vector components for WebGL
        var ambientColorArray = []; // 1D array of ambient color values
        var diffuseColorArray = []; // 1D array of diffuse color values
        var specularColorArray = []; // 1D array of specular color values
        var specularPowerArray = []; // 1D array of specular power values
        var indexArray = []; // 1D array of vertex indices for WebGL
        var vtxBufferSize = 0; // the number of vertices in the vertex buffer
        var vtxToAdd = []; // vtx coords to add to the coord array
        var normalToAdd = []; // normal components to add to the normal array
        var ambientToAdd = []; // ambient color data to add
        var diffuseToAdd = []; // diffuse color data to add
        var specularToAdd = []; // specular color data to add
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array
        var modelIndices = [];
        numModels = inputTriangles.length;

        triBufferSize = 0;
        for (var whichSet = 0; whichSet < inputTriangles.length; whichSet++) {
            vec3.set(indexOffset, vtxBufferSize, vtxBufferSize, vtxBufferSize); // update vertex offset

            // set up rolling sum to calculate center point of the triangle set
            var rollingCenterSum = [0, 0, 0];
            var vtxCount = 0;

            // set up the vertex coord array
            for (whichSetVert = 0; whichSetVert < inputTriangles[whichSet].vertices.length; whichSetVert++) {
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                coordArray.push(vtxToAdd[0], vtxToAdd[1], vtxToAdd[2]);

                // Add normal vector component data
                normalToAdd = inputTriangles[whichSet].normals[whichSetVert];
                normalArray.push(normalToAdd[0], normalToAdd[1], normalToAdd[2]);

                // Add ambient, diffuse, and specular color data
                ambientToAdd = inputTriangles[whichSet].material.ambient;
                diffuseToAdd = inputTriangles[whichSet].material.diffuse;
                specularToAdd = inputTriangles[whichSet].material.specular;
                ambientColorArray.push(ambientToAdd[0], ambientToAdd[1], ambientToAdd[2]);
                diffuseColorArray.push(diffuseToAdd[0], diffuseToAdd[1], diffuseToAdd[2]);
                specularColorArray.push(specularToAdd[0], specularToAdd[1], specularToAdd[2]);

                // Add specular power data
                specularPowerArray.push(inputTriangles[whichSet].material.n);

                // add the model index for each vertex
                modelIndices.push(whichSet);

                // sum the vertices into a rolling sum to calcualte the center later
                rollingCenterSum[0] += vtxToAdd[0];
                rollingCenterSum[1] += vtxToAdd[1];
                rollingCenterSum[2] += vtxToAdd[2];
                vtxCount++;

            }

            // calculate the center and push to the model centers array
            var center = vec3.fromValues(
                rollingCenterSum[0] / vtxCount,
                rollingCenterSum[1] / vtxCount,
                rollingCenterSum[2] / vtxCount
            );
            modelCenters.push(center);

            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri = 0; whichSetTri < inputTriangles[whichSet].triangles.length; whichSetTri++) {
                vec3.add(triToAdd, indexOffset, inputTriangles[whichSet].triangles[whichSetTri]);
                indexArray.push(triToAdd[0], triToAdd[1], triToAdd[2]);
            }

            vtxBufferSize += inputTriangles[whichSet].vertices.length; // total number of vertices
            triBufferSize += inputTriangles[whichSet].triangles.length; // total number of tris

            // Add a transofrmation matrix for every model
            modelMatrices.push(mat4.create());
            scaleMatrices.push(mat4.create());
            translationMatrices.push(mat4.create());
            rotationMatrices.push(mat4.create());

        } // end for each triangle set 
        triBufferSize *= 3;

        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW); // coords to that buffer

        // send the vertex normals to webGl
        normalBuffer = gl.createBuffer(); // init empty normals buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer); // activate buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW); // components to that buffer

        // send the color data to webGL (ambient, diffuse, specular, n)
        ambientColorBuffer = gl.createBuffer(); // init empty ambient color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, ambientColorBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ambientColorArray), gl.STATIC_DRAW); // ambient colors to that buffer

        diffuseColorBuffer = gl.createBuffer(); // init empty diffuse color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, diffuseColorBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diffuseColorArray), gl.STATIC_DRAW); // diffuse colors to that buffer

        specularColorBuffer = gl.createBuffer(); // init empty specular color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, specularColorBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specularColorArray), gl.STATIC_DRAW); // specular colors to that buffer

        specularPowerBuffer = gl.createBuffer();// init empty specular power buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, specularPowerBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specularPowerArray), gl.STATIC_DRAW); // activate that buffer

        // send the triangle indices to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW); // indices to that buffer

        // send the model indices to webGL
        modelIndicesBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, modelIndicesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(modelIndices), gl.STATIC_DRAW);

        // console.log(modelCenters);
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {

    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float;

        // Position Attributes
        varying vec3 fragVertexPosition;
        varying vec3 fragVertexNormal;

        // Color Attributes
        varying vec3 fragAmbientColor;
        varying vec3 fragDiffuseColor;
        varying vec3 fragSpecularColor;
        varying float fragSpecularPower;

        // Light data
        uniform vec3 lightPos;
        uniform vec3 lightAmbient;
        uniform vec3 lightDiffuse;
        uniform vec3 lightSpecular;

        void main(void) {
            vec3 normal = normalize(fragVertexNormal);
            vec3 lightDirection = normalize(lightPos - fragVertexPosition);
            vec3 viewDirection = normalize(-fragVertexPosition); // Assuming the eye is at the origin
        
            // Calculate ambient component
            vec3 ambient = lightAmbient * fragAmbientColor;
        
            // Calculate diffuse component
            float lambertian = max(dot(normal, lightDirection), 0.0);
            vec3 diffuse = lightDiffuse * fragDiffuseColor * lambertian;
        
            // Calculate specular component (Blinn-Phong)
            vec3 halfVector = normalize(lightDirection + viewDirection);
            float specularAngle = max(dot(normal, halfVector), 0.0);
            float specularComponent = pow(specularAngle, fragSpecularPower);
            vec3 specular = lightSpecular * fragSpecularColor * specularComponent;
        
            // Combine ambient, diffuse, and specular to get the final color
            vec3 result = ambient + diffuse + specular;
        
            gl_FragColor = vec4(result, 1.0);
        }
    `;

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        // Position attributes
        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;
        // Varying Position Attributes to pass to fragment shader
        varying vec3 fragVertexPosition;
        varying vec3 fragVertexNormal;

        // Color Attributes
        attribute vec3 ambientColor;
        attribute vec3 diffuseColor;
        attribute vec3 specularColor;
        attribute float specularPower;
        // Varying Color Attributes to pass to fragment shader
        varying vec3 fragAmbientColor;
        varying vec3 fragDiffuseColor;
        varying vec3 fragSpecularColor;
        varying float fragSpecularPower;

        attribute float modelIndex;

        #define MAX_MODELS 10 // max number of models this shader supports

        // matrix data as an array of vec4's
        uniform vec4 matrixData[MAX_MODELS * 4];

        // view-projection matrix
        uniform mat4 vpMatrix;

        // build a mat4 for any given model index
        mat4 buildMat4(int index) {
            int offset = index * 4;
            return mat4(
                matrixData[offset], matrixData[offset + 1], matrixData[offset + 2], matrixData[offset + 3]
            );
        }

        void main(void) {
            mat4 modelMatrix = buildMat4(int(modelIndex));
            mat4 mvpMatrix = vpMatrix * modelMatrix;

            gl_Position = mvpMatrix * vec4(vertexPosition, 1.0); // use the untransformed position

            fragVertexPosition = mat3(mvpMatrix) * vertexPosition;
            fragVertexNormal = mat3(mvpMatrix) * vertexNormal;

            fragAmbientColor = ambientColor;
            fragDiffuseColor = diffuseColor;
            fragSpecularColor = specularColor;
            fragSpecularPower = specularPower;
        }
    `;

    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader, fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader, vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            gl.deleteShader(fShader);
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            gl.deleteShader(vShader);
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
        } else { // no compile errors
            shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition");
                gl.enableVertexAttribArray(vertexPositionAttrib);
                vertexNormalAttrib = // get pointer to normal shader input
                    gl.getAttribLocation(shaderProgram, "vertexNormal");
                gl.enableVertexAttribArray(vertexNormalAttrib);
                ambientColorAttrib = // get pointer to ambient attribute
                    gl.getAttribLocation(shaderProgram, "ambientColor");
                gl.enableVertexAttribArray(ambientColorAttrib);
                diffuseColorAttrib = // get pointer to diffuse attribute
                    gl.getAttribLocation(shaderProgram, "diffuseColor");
                gl.enableVertexAttribArray(diffuseColorAttrib);
                specularColorAttrib = // get pointer to specular attribute
                    gl.getAttribLocation(shaderProgram, "specularColor");
                gl.enableVertexAttribArray(specularColorAttrib);
                specularPowerAttrib = // get pointer to specular power attribute
                    gl.getAttribLocation(shaderProgram, "specularPower");
                gl.enableVertexAttribArray(specularPowerAttrib);
                var lightPosUniform = gl.getUniformLocation(shaderProgram, "lightPos");
                gl.uniform3fv(lightPosUniform, lightPos);
                var lightAmbientUniform = gl.getUniformLocation(shaderProgram, "lightAmbient");
                gl.uniform3fv(lightAmbientUniform, lightAmbient);
                var lightDiffuseUniform = gl.getUniformLocation(shaderProgram, "lightDiffuse");
                gl.uniform3fv(lightDiffuseUniform, lightDiffuse);
                var lightSpecularUniform = gl.getUniformLocation(shaderProgram, "lightSpecular");
                gl.uniform3fv(lightSpecularUniform, lightSpecular);
                // Enable the vertex model index attribute
                modelIndicesAttrib =
                    gl.getAttribLocation(shaderProgram, "modelIndex");
                gl.enableVertexAttribArray(modelIndicesAttrib);
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 

    catch (e) {
        console.log(e);
    } // end catch
} // end setup shaders
var bgColor = 0;

// flatten an array of matrices into an array of float32's
function flattenMatrices(matrixArray) {
    var size = 16 * matrixArray.length; // Assuming each matrix is 4x4 (16 values)
    var flattenedArray = new Float32Array(size);
    var index = 0;

    matrixArray.forEach(function (matrix) {
        for (var i = 0; i < matrix.length; i++) {
            flattenedArray[index] = matrix[i];
            index++;
        }
    });

    return flattenedArray;
}

// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

    // Model View Projection, in that order

    // start with fresh identity matrices for all model matrices
    for (var i = 0; i < numModels; i++) {
        modelMatrices[i] = mat4.create();

        // handle scaling
        if (selected && i == selectedModelIdx) {
            scaleMatrices[i] = scaleByFactor(modelCenters[i], 1.2);
        } else {
            scaleMatrices[i] = mat4.create();
        }
        mat4.multiply(modelMatrices[i], modelMatrices[i], scaleMatrices[i]);

        // handle translation
        mat4.multiply(modelMatrices[i], modelMatrices[i], translationMatrices[i]);

        // handle rotation
        mat4.multiply(modelMatrices[i], modelMatrices[i], rotationMatrices[i]);
    }

    // flatten the model matrices before sending to shader
    var matrixData = flattenMatrices(modelMatrices);
    var matrixDataLocation = gl.getUniformLocation(shaderProgram, "matrixData"); // Get the uniform location
    gl.uniform4fv(matrixDataLocation, matrixData);

    // update view matrix
    var viewMatrix = mat4.create();
    var eye = vec3.fromValues(Eye[0], Eye[1], Eye[2]);
    var at = vec3.create();
    vec3.add(at, eye, lookAt);
    mat4.lookAt(viewMatrix, eye, at, lookUp);

    // update projection matrix
    var projectionMatrix = mat4.create();
    var aspectRatio = canvasWidth / canvasHeight;
    var fieldOfView = 70 * Math.PI / 180; // 45-degree field of view, adjust as needed
    var near = 0.1; // Near clipping plane, adjust as needed
    var far = 100.0; // Far clipping plane, adjust as needed
    mat4.perspective(projectionMatrix, fieldOfView, aspectRatio, near, far);

    // create view-projection matrix (VP)
    var viewProjectionMatrix = mat4.create();
    mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

    // Pass the mvpMatrix to the shader as a uniform
    var mvpMatrixUniform = gl.getUniformLocation(shaderProgram, "vpMatrix");
    gl.uniformMatrix4fv(mvpMatrixUniform, false, viewProjectionMatrix);

    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0); // feed

    // activate and feed normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer); // activate
    gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0); // feed

    // activate and feed color buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, ambientColorBuffer); // activate
    gl.vertexAttribPointer(ambientColorAttrib, 3, gl.FLOAT, false, 0, 0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER, diffuseColorBuffer); // activate
    gl.vertexAttribPointer(diffuseColorAttrib, 3, gl.FLOAT, false, 0, 0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER, specularColorBuffer); // activate
    gl.vertexAttribPointer(specularColorAttrib, 3, gl.FLOAT, false, 0, 0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER, specularPowerBuffer); // activate
    gl.vertexAttribPointer(specularPowerAttrib, 1, gl.FLOAT, false, 0, 0); // feed

    // activate and feed the model index
    gl.bindBuffer(gl.ARRAY_BUFFER, modelIndicesBuffer); // activate
    gl.vertexAttribPointer(modelIndicesAttrib, 1, gl.FLOAT, false, 0, 0); // feed

    // activate and feed the traingle buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate
    gl.drawElements(gl.TRIANGLES, triBufferSize, gl.UNSIGNED_SHORT, 0); // render

    requestAnimationFrame(renderTriangles);
} // end render triangles

function scaleByFactor(center, scalingFactor) {
    const scaleMatrix = mat4.create();

    // Create a translation matrix to move the center to the origin
    const translateToOrigin = mat4.create();
    mat4.fromTranslation(translateToOrigin, vec3.negate(vec3.create(), center));

    // Create a scaling matrix to perform the uniform scaling by the specified factor
    const scaleVector = vec3.fromValues(scalingFactor, scalingFactor, scalingFactor);
    const scale = mat4.create();
    mat4.fromScaling(scale, scaleVector);

    // Create a translation matrix to move the center back to its original position
    const translateBack = mat4.create();
    mat4.fromTranslation(translateBack, center);

    // Combine the matrices to get the final transformation matrix
    mat4.multiply(scaleMatrix, scaleMatrix, translateBack);
    mat4.multiply(scaleMatrix, scaleMatrix, scale);
    mat4.multiply(scaleMatrix, scaleMatrix, translateToOrigin);

    return scaleMatrix;
}

function innerRotate(center, radians, axis) {
    const finalRotMatrix = mat4.create();

    // Create a translation matrix to move the center to the origin
    const translateToOrigin = mat4.create();
    mat4.fromTranslation(translateToOrigin, vec3.negate(vec3.create(), center));

    // Create the rotation matrix
    var rotationMatrix = mat4.create();
    mat4.rotate(rotationMatrix, rotationMatrix, radians, axis);

    // Create a translation matrix to move the center back to its original position
    const translateBack = mat4.create();
    mat4.fromTranslation(translateBack, center);

    // Combine matrices
    mat4.multiply(finalRotMatrix, finalRotMatrix, translateBack);
    mat4.multiply(finalRotMatrix, finalRotMatrix, rotationMatrix);
    mat4.multiply(finalRotMatrix, finalRotMatrix, translateToOrigin);

    return finalRotMatrix;
}

// handle all key presses
function handleKeyEvent(event) {

    var tAmt = 0.01;

    // for yaw rotations to remove duplicate code
    var yawInRadians = (-1 * Math.PI) / 180;

    // for pitch rotations to remove duplicate code
    var pitchInRadians = (-1 * Math.PI) / 180;

    // for up and down translation
    var up = vec3.create();
    vec3.normalize(up, lookUp);

    // for left and right translations, and for pitch
    var forward = vec3.create();
    vec3.normalize(forward, lookAt);
    var left = vec3.create();
    vec3.normalize(left, vec3.cross(vec3.create(), forward, lookUp));

    switch (event.key) {

        // translate eye left and right relative to view
        case 'a':
            tAmt *= -1;
        case 'd':
            vec3.add(Eye, Eye, vec3.scale(left, left, tAmt));
            break;

        // translate eye forward and backward relative to view
        case 's':
            tAmt *= -1;
        case 'w':
            var forward = vec3.create();
            vec3.normalize(forward, lookAt);
            vec3.add(Eye, Eye, vec3.scale(forward, forward, tAmt));
            break;

        // translate eye up and down relative to view
        case 'e':
            tAmt *= -1;
        case 'q':
            vec3.add(Eye, Eye, vec3.scale(up, up, tAmt));
            break;

        // rotate view left and right (yaw - rotate along y axis)
        case 'A':
            yawInRadians *= -1;
        case 'D':
            var rotationMatrix = mat4.create();
            mat4.rotate(rotationMatrix, rotationMatrix, yawInRadians, lookUp);
            vec3.transformMat4(lookAt, lookAt, rotationMatrix);
            break;

        // rotate view forward and backward (pitch - rotate along x axis)
        case 'W':
            pitchInRadians *= -1;
        case 'S':
            var rotationMatrix = mat4.create();
            mat4.rotate(rotationMatrix, rotationMatrix, pitchInRadians, left);
            vec3.transformMat4(lookAt, lookAt, rotationMatrix);
            vec3.transformMat4(lookUp, lookUp, rotationMatrix);
            break;

        // select a model and highlight it if selected
        case ' ':
            selected = !selected;
            break;
        case 'ArrowLeft':
            selectedModelIdx -= 1;
            selectedModelIdx = selectedModelIdx == -1 ? numModels - 1 : selectedModelIdx;
            break;
        case 'ArrowRight':
            selectedModelIdx += 1;
            selectedModelIdx = selectedModelIdx == numModels ? 0 : selectedModelIdx;
            break;

        // translate selected model left and right
        case 'k': // left
            tAmt *= -1;
        case ';': // right
            if (selected) {
                // create translation matrix exactly for tAmt 
                var translationMatrix = mat4.create();
                mat4.translate(
                    translationMatrix,
                    translationMatrix,
                    vec3.scale(vec3.create(), left, tAmt)
                );
                // apply this matrix to the existing translation matrix
                mat4.multiply(
                    translationMatrices[selectedModelIdx],
                    translationMatrices[selectedModelIdx],
                    translationMatrix
                );
                // update centers
                vec3.transformMat4(
                    modelCenters[selectedModelIdx],
                    modelCenters[selectedModelIdx],
                    translationMatrix
                );
            }
            break;

        // translate selected model forward and backward
        case 'l': // backwrd
            tAmt *= -1;
        case 'o': // forward
            if (selected) {
                // create translation matrix exactly for tAmt 
                var translationMatrix = mat4.create();
                mat4.translate(
                    translationMatrix,
                    translationMatrix,
                    vec3.scale(vec3.create(), forward, tAmt)
                );
                // apply this matrix to the existing translation matrix
                mat4.multiply(
                    translationMatrices[selectedModelIdx],
                    translationMatrices[selectedModelIdx],
                    translationMatrix
                );
                // update centers
                vec3.transformMat4(
                    modelCenters[selectedModelIdx],
                    modelCenters[selectedModelIdx],
                    translationMatrix
                );
            }
            break;

        // translate selected model up and down
        case 'i': // up
            tAmt *= -1;
        case 'p': // down
            if (selected) {
                // create translation matrix exactly for tAmt 
                var translationMatrix = mat4.create();
                mat4.translate(
                    translationMatrix,
                    translationMatrix,
                    vec3.scale(vec3.create(), up, tAmt)
                );
                // apply this matrix to the existing translation matrix
                mat4.multiply(
                    translationMatrices[selectedModelIdx],
                    translationMatrices[selectedModelIdx],
                    translationMatrix
                );
                // update centers
                vec3.transformMat4(
                    modelCenters[selectedModelIdx],
                    modelCenters[selectedModelIdx],
                    translationMatrix
                );
            }
            break;
        // rotate selected model around view Y (yaw)
        case 'K':
            yawInRadians *= -1;
        case ':':
            if (selected) {
                // create rotation matrix
                var rotationMatrix = innerRotate(modelCenters[selectedModelIdx], yawInRadians, lookUp);

                // update rotation matrix
                mat4.multiply(
                    rotationMatrices[selectedModelIdx],
                    rotationMatrices[selectedModelIdx],
                    rotationMatrix
                );
            }
            break;
        
        case 'O':
            pitchInRadians *= -1;
        case 'L':
            if (selected) {
                // create rotation matrix
                var axis = vec3.create();
                vec3.cross(axis, lookAt, lookUp);
                var rotationMatrix = innerRotate(modelCenters[selectedModelIdx], pitchInRadians, axis);

                // update rotation matrix
                mat4.multiply(
                    rotationMatrices[selectedModelIdx],
                    rotationMatrices[selectedModelIdx],
                    rotationMatrix
                );
            }
            break;

            case 'I':
                pitchInRadians *= -1;
            case 'P':
                if (selected) {
                    // create rotation matrix
                    var rotationMatrix = innerRotate(modelCenters[selectedModelIdx], pitchInRadians, lookAt);
    
                    // update rotation matrix
                    mat4.multiply(
                        rotationMatrices[selectedModelIdx],
                        rotationMatrices[selectedModelIdx],
                        rotationMatrix
                    );
                }
                break;
        default:
        // Do nothing
    }
    // console.log(selectedModelIdx);
}

/* MAIN -- HERE is where execution begins after window load */
function main() {

    setupWebGL(); // set up the webGL environment
    loadTriangles(); // load in the triangles from tri file
    setupShaders(); // setup the webGL shaders
    renderTriangles(); // draw the triangles using webGL

    console.log(modelMatrices.length);

    document.addEventListener('keydown', handleKeyEvent); // handle key inputs

    // Function to update the Eye values
    function updateEyeValues() {
        document.getElementById("eyeX").textContent = Eye[0].toFixed(2);
        document.getElementById("eyeY").textContent = Eye[1].toFixed(2);
        document.getElementById("eyeZ").textContent = Eye[2].toFixed(2);
    }
    // Function to update the At values
    function updateAtValues() {
        document.getElementById("atX").textContent = lookAt[0].toFixed(2);
        document.getElementById("atY").textContent = lookAt[1].toFixed(2);
        document.getElementById("atZ").textContent = lookAt[2].toFixed(2);
    }
    // Function to update the Up values
    function updateUpValues() {
        document.getElementById("upX").textContent = lookUp[0].toFixed(2);
        document.getElementById("upY").textContent = lookUp[1].toFixed(2);
        document.getElementById("upZ").textContent = lookUp[2].toFixed(2);
    }

    // Call the update function every 100 milliseconds (adjust the interval as needed)
    setInterval(updateEyeValues, 100);
    setInterval(updateAtValues, 100);
    setInterval(updateUpValues, 100);

} // end main
