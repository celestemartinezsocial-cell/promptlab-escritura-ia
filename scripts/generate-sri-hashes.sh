#!/bin/bash
# Run this script on your MacBook to generate SRI hashes for CDN dependencies
# Usage: bash scripts/generate-sri-hashes.sh

echo "Generating SRI hashes for CDN dependencies..."
echo ""

REACT_HASH=$(curl -sL "https://unpkg.com/react@18.3.1/umd/react.production.min.js" | openssl dgst -sha384 -binary | openssl base64 -A)
echo "React 18.3.1:"
echo "  sha384-$REACT_HASH"
echo ""

REACT_DOM_HASH=$(curl -sL "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" | openssl dgst -sha384 -binary | openssl base64 -A)
echo "React-DOM 18.3.1:"
echo "  sha384-$REACT_DOM_HASH"
echo ""

BABEL_HASH=$(curl -sL "https://unpkg.com/@babel/standalone@7.26.4/babel.min.js" | openssl dgst -sha384 -binary | openssl base64 -A)
echo "Babel 7.26.4:"
echo "  sha384-$BABEL_HASH"
echo ""

echo "---"
echo "Copy the hashes above and update index.html:"
echo ""
echo "<script crossorigin=\"anonymous\" integrity=\"sha384-$REACT_HASH\" src=\"https://unpkg.com/react@18.3.1/umd/react.production.min.js\"></script>"
echo "<script crossorigin=\"anonymous\" integrity=\"sha384-$REACT_DOM_HASH\" src=\"https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js\"></script>"
echo "<script crossorigin=\"anonymous\" integrity=\"sha384-$BABEL_HASH\" src=\"https://unpkg.com/@babel/standalone@7.26.4/babel.min.js\"></script>"
