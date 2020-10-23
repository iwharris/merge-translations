# merge-translations
CLI utility to merge translations files


## Installation

```bash
npm install -g @iwharris/merge-translations
```

## Usage

Print merged JSON to console:

```bash
# Using glob patterns
merge-translations path/to/**/missingTranslations* > merged.json

# Using multiple file paths
merge-translations path/to/file1 path/to/file2 > merged.json
```



