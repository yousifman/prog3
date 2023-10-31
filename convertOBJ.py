import json

def parse_obj_file(file_path):
    vertices = []
    normals = []
    triangles = []

    with open(file_path, 'r') as file:
        for line in file:
            if line.startswith('v '):
                vertex_data = list(map(float, line[2:].strip().split()))
                scaled_vertex = [coord * (1/100) for coord in vertex_data]
                vertices.append(scaled_vertex)
            elif line.startswith('vn '):
                normal_data = list(map(float, line[3:].strip().split()))
                normals.append(normal_data)
            elif line.startswith('f '):
                face_data = line[2:].strip().split()
                face_indices = [int(data.split('//')[0]) - 1 for data in face_data]
                triangles.append(face_indices)

    return vertices, normals, triangles

def translate_to_point(vertices, point):
    return [[v[0] + point[0], v[1] + point[1], v[2] + point[2]] for v in vertices]

def mirror_xy_plane(vertices):
    mirrored_vertices = [[v[0], v[1], -v[2]] for v in vertices]
    return mirrored_vertices

def mirror_normals(normals):
    mirrored_normals = [[n[0], n[1], -n[2]] for n in normals]
    return mirrored_normals

def create_json(vertices, normals, triangles):
    data = {
        "material": {"ambient": [0.1, 0.1, 0.1], "diffuse": [0.6, 0.4, 0.4], "specular": [0.3, 0.3, 0.3], "n": 11},
        "vertices": vertices,
        "normals": normals,
        "triangles": triangles
    }

    return [data]

def obj_to_json(obj_file_path, output_json_path):
    vertices, normals, triangles = parse_obj_file(obj_file_path)
    translated_vertices = translate_to_point(vertices, [1/2, -3/8, -1])
    mirrored_vertices = mirror_xy_plane(translated_vertices)
    mirrored_normals = mirror_normals(normals)
    data = create_json(mirrored_vertices, mirrored_normals, triangles)

    with open(output_json_path, 'w') as json_file:
        json.dump(data, json_file, indent=4)

# Example usage
obj_file_path = "Kirby.obj"  # Replace with the path to your .obj file
output_json_path = "Kirby.json"  # Replace with the desired output JSON file path

obj_to_json(obj_file_path, output_json_path)
