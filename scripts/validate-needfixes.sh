#!/bin/bash
# NEEDFIXES.md Validation Script
# This script validates the NEEDFIXES.md document for markdown compliance and working links

set -e

echo "🔍 Validating NEEDFIXES.md..."

# Check if required files exist
if [ ! -f "NEEDFIXES.md" ]; then
    echo "❌ NEEDFIXES.md not found!"
    exit 1
fi

if [ ! -f ".markdownlint.json" ]; then
    echo "❌ .markdownlint.json not found!"
    exit 1
fi

# Run markdown linting
echo "📝 Running markdown linter..."
npx markdownlint-cli NEEDFIXES.md --config .markdownlint.json

if [ $? -eq 0 ]; then
    echo "✅ Markdown linting passed"
else
    echo "❌ Markdown linting failed"
    exit 1
fi

# Check links
echo "🔗 Checking links..."
npx markdown-link-check NEEDFIXES.md

if [ $? -eq 0 ]; then
    echo "✅ Link checking passed"
else
    echo "❌ Link checking failed"
    exit 1
fi

# Verify key sections exist
echo "📄 Verifying document structure..."
if grep -q "## 0️⃣ Executive Summary" NEEDFIXES.md; then
    echo "✅ Executive Summary section found"
else
    echo "❌ Executive Summary section missing"
    exit 1
fi

if grep -q "## Next Steps Checklist for Maintainers" NEEDFIXES.md; then
    echo "✅ Next Steps section found"
else
    echo "❌ Next Steps section missing"
    exit 1
fi

if grep -q "## 📈 \*\*Expected Impact Summary\*\*" NEEDFIXES.md; then
    echo "✅ Expected Impact Summary found"
else
    echo "❌ Expected Impact Summary missing"
    exit 1
fi

echo ""
echo "🎉 NEEDFIXES.md validation completed successfully!"
echo "📊 Document is ready for team review and CI pipeline integration."
