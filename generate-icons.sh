#!/bin/bash

# Script to generate PWA icons from a source image
# Usage: ./generate-icons.sh source-image.png

if [ $# -eq 0 ]; then
    echo "Usage: $0 source-image.png"
    echo "Generates PWA icons from a source image"
    echo "Requires ImageMagick (brew install imagemagick)"
    exit 1
fi

SOURCE_IMAGE="$1"

if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "Error: Source image '$SOURCE_IMAGE' not found"
    exit 1
fi

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick not found. Please install it with:"
    echo "brew install imagemagick"
    exit 1
fi

# Create icons directory
mkdir -p icons

# Generate icons in various sizes
echo "Generating PWA icons..."

declare -a sizes=(16 32 72 96 128 144 152 192 384 512)

for size in "${sizes[@]}"; do
    echo "Generating ${size}x${size} icon..."
    convert "$SOURCE_IMAGE" -resize "${size}x${size}" "icons/icon-${size}x${size}.png"
done

echo "Icon generation complete!"
echo "Generated icons:"
ls -la icons/

echo ""
echo "Quick test with a placeholder icon:"
echo "You can also create a simple colored square as a placeholder:"
echo "convert -size 512x512 xc:'#333333' -fill white -gravity center -pointsize 200 -annotate +0+0 'FV' icons/icon-512x512.png"