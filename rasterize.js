/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles.json"; // triangles file loc
// const INPUT_LIGHTS_URL = "https://ncsucgclass.github.io/prog3/lights.json"; // lights file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";
//const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog3/spheres.json"; // spheres file loc
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0); // default eye position in world space
var lightPos = new vec3.fromValues(-0.5,1.5,-0.5);
var lightAmbient = new vec3.fromValues(1.0,1.0,1.0);
var lightDiffuse = new vec3.fromValues(1.0,1.0,1.0);
var lightSpecular = new vec3.fromValues(1.0,1.0,1.0);

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!

var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize; // the number of indices in the triangle buffer

var vertexBuffer; // this contains vertex coordinates in triples
var normalBuffer; // this contains all the vertex normal vectors
var ambientColorBuffer; // this contains ambient color values in triples
var diffuseColorBuffer; // this contains diffuse color values in triples
var specularColorBuffer; // this contains specular color values in triples
var altPosition; // flag indicating whether to alter vertex positions

var vertexPositionAttrib; // where to put position for vertex shader
var vertexNormalAttrib; // where to put normals for vertex shader
var ambientColorAttrib; // where to put ambient color for vertex shader
var diffuseColorAttrib; // where to put diffuse color for vertex shader
var specularColorAttrib; //where to put specular color for vertex shader
var altPositionUniform; // where to put altPosition flag for vertex shader


// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var coordArray = []; // 1D array of vertex coords for WebGL
        var normalArray = []; // 1D array of normal vector components for WebGL
        var ambientColorArray = []; // 1D array of ambient color values
        var diffuseColorArray = []; // 1D array of diffuse color values
        var specularColorArray = []; // 1D array of specular color values
        var indexArray = []; // 1D array of vertex indices for WebGL
        var vtxBufferSize = 0; // the number of vertices in the vertex buffer
        var vtxToAdd = []; // vtx coords to add to the coord array
        var normalToAdd = []; // normal components to add to the normal array
        var ambientToAdd = []; // ambient color data to add
        var diffuseToAdd = []; // diffuse color data to add
        var specularToAdd = []; // specular color data to add
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array
        
        triBufferSize = 0;
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {
            vec3.set(indexOffset, vtxBufferSize, vtxBufferSize, vtxBufferSize); // update vertex offset

            // set up the vertex coord array
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++){
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
            }

            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri = 0; whichSetTri < inputTriangles[whichSet].triangles.length; whichSetTri++) {
                vec3.add(triToAdd, indexOffset, inputTriangles[whichSet].triangles[whichSetTri]);
                indexArray.push(triToAdd[0], triToAdd[1], triToAdd[2]);
            }

            vtxBufferSize += inputTriangles[whichSet].vertices.length; // total number of vertices
            triBufferSize += inputTriangles[whichSet].triangles.length; // total number of tris
        } // end for each triangle set 
        triBufferSize *= 3

        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer

        // send the vertex normals to webGl
        normalBuffer = gl.createBuffer(); // init empty normals buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer); // activate buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(normalArray),gl.STATIC_DRAW); // components to that buffer

        console.log(coordArray);
        console.log(normalArray);
        
        // send the color data to webGL (ambient, diffuse, specular)
        ambientColorBuffer = gl.createBuffer(); // init empty ambient color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, ambientColorBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ambientColorArray), gl.STATIC_DRAW); // ambient colors to that buffer

        diffuseColorBuffer = gl.createBuffer(); // init empty diffuse color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, diffuseColorBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diffuseColorArray), gl.STATIC_DRAW); // diffuse colors to that buffer

        specularColorBuffer = gl.createBuffer(); // init empty specular color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, specularColorBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specularColorArray), gl.STATIC_DRAW); // specular colors to that buffer

        // send the triangle indices to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW); // indices to that buffer

        
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float;

        // Position Attributes
        varying vec3 fragVertexPosition;
        varying vec3 fragNormal;

        // Color Attributes
        varying vec3 fragAmbientColor;
        varying vec3 fragDiffuseColor;
        varying vec3 fragSpecularColor;

        void main(void) {
            // Shader will not compile if not all attributes are used. This is temporary.
            vec3 a = fragAmbientColor + fragDiffuseColor + fragSpecularColor; 
            vec3 b = fragVertexPosition + fragNormal;

            gl_FragColor = vec4(fragDiffuseColor.r, fragDiffuseColor.g, fragDiffuseColor.b, 1.0); // all fragments are diffuse color
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        // Position attributes
        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;
        // Varying Position Attributes to pass to fragment shader
        varying vec3 fragVertexPosition;
        varying vec3 fragNormal;

        uniform bool altPosition;

        // Color Attributes
        attribute vec3 ambientColor;
        attribute vec3 diffuseColor;
        attribute vec3 specularColor;
        // Varying Color Attributes to pass to fragment shader
        varying vec3 fragAmbientColor;
        varying vec3 fragDiffuseColor;
        varying vec3 fragSpecularColor;

        void main(void) {
            if(altPosition)
                gl_Position = vec4(vertexPosition + vec3(-1.0, -1.0, 0.0), 1.0); // use the altered position
            else
                gl_Position = vec4(vertexPosition, 1.0); // use the untransformed position

            fragVertexPosition = vertexPosition;
            fragNormal = vertexNormal;

            fragAmbientColor = ambientColor;
            fragDiffuseColor = diffuseColor;
            fragSpecularColor = specularColor;
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            gl.deleteShader(fShader);
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            gl.deleteShader(vShader);
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
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
                altPositionUniform = // get pointer to altPosition flag
                    gl.getUniformLocation(shaderProgram, "altPosition");
                ambientColorAttrib = // get pointer to ambient attribute
                    gl.getAttribLocation(shaderProgram, "ambientColor");
                gl.enableVertexAttribArray(ambientColorAttrib);
                diffuseColorAttrib = // get pointer to diffuse attribute
                    gl.getAttribLocation(shaderProgram, "diffuseColor");
                gl.enableVertexAttribArray(diffuseColorAttrib);
                specularColorAttrib = // get pointer to specular attribute
                    gl.getAttribLocation(shaderProgram, "specularColor");
                gl.enableVertexAttribArray(specularColorAttrib);
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
    altPosition = false;
    // setTimeout(function alterPosition() {
    //     altPosition = !altPosition;
    //     setTimeout(alterPosition, 2000);
    // }, 2000); // switch flag value every 2 seconds
} // end setup shaders
var bgColor = 0;
// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    // bgColor = (bgColor < 1) ? (bgColor + 0.001) : 0;
    // gl.clearColor(bgColor, 0, 0, 1.0);
    requestAnimationFrame(renderTriangles);

    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

    // activate and feed normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer); // activate
    gl.vertexAttribPointer(vertexNormalAttrib,3,gl.FLOAT,false,0,0); // feed

    // activate and feed color buffers
    gl.bindBuffer(gl.ARRAY_BUFFER,ambientColorBuffer); // activate
    gl.vertexAttribPointer(ambientColorAttrib,3,gl.FLOAT,false,0,0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER,diffuseColorBuffer); // activate
    gl.vertexAttribPointer(diffuseColorAttrib,3,gl.FLOAT,false,0,0); // feed
    gl.bindBuffer(gl.ARRAY_BUFFER,specularColorBuffer); // activate
    gl.vertexAttribPointer(specularColorAttrib,3,gl.FLOAT,false,0,0); // feed

    gl.uniform1i(altPositionUniform, altPosition); // feed

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate
    gl.drawElements(gl.TRIANGLES,triBufferSize,gl.UNSIGNED_SHORT,0); // render
} // end render triangles


/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadTriangles(); // load in the triangles from tri file
  setupShaders(); // setup the webGL shaders
  renderTriangles(); // draw the triangles using webGL
  
} // end main
