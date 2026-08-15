*** MANUALLY WRITTEN HUMAN GENERATED TEXT, KEEP AS ORIGINAL REFERENCE, DO NOT EDIT ***

# 2D texture map composition web app

## Product spec
- I got a bunch of images texture maps.
    - base color
    - normal
    - roughness
    - displacement
    - opacity
    - etc....
- I don't need 3D output
- I need a final image that's is created by combining and configuring these various images
- Here's the workflow I need
    - Node manager
    - Load image node
        - Output can be plain rgb image
        - Output can be mask image
            - image node should have option to choose what will be used as mask
                - Luminosity, alpha channel, R, G, B            
    - Material node
        - takes all the supported map types as input
            - Base color (Mandatory)
                - You can pick a color with hsl color picker or enter hex code
            - Normal (Optional)            
            - opacity (Optional)
            - roughness/normal/Bump/displacemnt (Optional), (Since we don't deal with 3D, all of these are the same for our use case)
            - Lights: can accept multiple light nodes
                - If there is no light, there's a default light with direction going from NW to SE
    - Resize image node
        - Select various resampling methods, support all
    - Color correction
        - Hue, saturation, tint, temperature
    - Brightness correction
        - Exposure, Highlights, shadows, whites, blacks
    - Merge 2 image nodes with different blend modes OR modifier fucntions
        - Need to exhaustively support all blend modes
        - Toggle between which layer is on top
        - Modifier fucntion
            - Opacity: Image A is affected by opacity map to be merged with image B
            - Normal map, Bump/displacement map, they are all the same for our use case as we are not dealing with 3D and only doing 2D image processing
                - should be affected by global lights
                - I've seen a lot of variations of Normal map, be flexible in supporting all types of normal map and do some preprocessing that will standardize all normal maps to work with downstream implementation of our app. Even when a normal image is given, convert it into some version of normal map that can be used. The result might be unpredictable, but that can be an organic creative play feature.
                - Same for bump map, as long as it's an image, convert it into greyscale and use it as bump map. Be forgiving and versatile about what image is accepted as bump map.
    - Lights node
        - Control intensity, tint, tint-percentage, direction
        - All lights are parallel infinity light
        - Default tint is white
    - Image to single color node
        - This node takes an imput image and displays a single color swatch that represents the color of the image.
        - This should be fucntionally the equivalent of blurring the whole image until I get a single color
        - The HSL value and hex code are shown for the color
        - A target color can also be specified which can be picked manually or entered with hex code
        - A side by side conparison is shown if the target color is specified.
        - The goal here is to see if a texture image can be used as fill image interchangeably with the target fill color.
        - The delta in the hsl value is shown in the color from image to indicate how far off it is from the target value.
    - Image preview node
        - can preview images
        - can preview masks
        - Download image as tiff, png, jpg
    - Custom hsl color picker for all color picking needs. Make the Design exactly similar to how the color picker is in Figma.
    - Reactflow: Node UI
        - Support light and dark mode
        - Minimap navigation
        - Saving files in indexdb
        - save workflow as json
            - Workflows include node size and position
            - Workflows should have all data to exactly recreate the workflow snapshot.
        - workflows jsons are embedded in downloaded pngs
        - All nodes supports
            - Bypass (ctrl + b)
            - mute (ctrl + m)
            - locking (ctrl + l)
            - Resizing
        - Node snapshot like states, position, size, layering, values etc are all remembered instantly and also saved in the json
        - All standard controls for node UI
            - Shortcuts and toolbar controls for zoom
            - zoom to fit, zoom to selection etc.
            - standard pan controls


## Tech stack
    - React flow web app

## Execution approach

- Refer this seed spec and make a complete detailing plan to spec this out and detailed every aspect of this to create an implementation ready spec and implementation plan.
- Do not confuse between detailing plan and implementation plan
- Detailing plan is the plan to spec out the app and the implementation plan
- What research is needed? Do deep research on all relevant topics.
- What agent skills should be used to improve the quality of work and output?
- Scalable robust design system
- What technical consideration should be made
- What're the best industry practices
- What to watch out for
- Security, privacy concerns
- Performance consideration
- Edge cases and loop holes to be avoided

### Agent graph and loop
- Execution and implementation by graph and loop method described here agent-graph-loop.md


    