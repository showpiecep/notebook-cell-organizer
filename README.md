# Notebook Cell Organizer

![Demo](images/demo.gif)

A VS Code extension that automatically reorganizes cells in a Jupyter Notebook — moving shell commands and imports to dedicated cells at the top.

## What It Does

When working on data science notebooks, shell commands (`!pip install`, `%pip`, `%conda`) and import statements tend to get scattered throughout the file. This extension collects them into two clean cells at the top of the notebook:

- **Cell 0** — all shell commands
- **Cell 1** — all import statements

Lines are extracted from their original cells. Cells that become empty are removed. Duplicate lines are deduplicated automatically.

**Before:**

```
[cell 0]  !pip install pandas
          import numpy as np
          x = 1

[cell 1]  import pandas as pd
          df = pd.read_csv(...)

[cell 2]  import numpy as np   ← duplicate
          model.fit(X, y)
```

**After:**

```
[cell 0]  !pip install pandas

[cell 1]  import numpy as np
          import pandas as pd

[cell 2]  x = 1

[cell 3]  df = pd.read_csv(...)

[cell 4]  model.fit(X, y)
```

## Usage

### Command Palette

`Cmd+Shift+P` → `Notebook: Organize Notebook Cells`

### Toolbar Button

Click the **⊟** button in the notebook toolbar (appears automatically when a Jupyter notebook is open).

### Auto-organize on Save

Enable in settings: `Cmd+,` → search for `organizeOnSave` → toggle on.

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `notebook-cell-organizer.organizeOnSave` | boolean | `false` | Automatically organize cells every time the notebook is saved |

## Recognized Patterns

**Shell commands** (moved to cell 0):

```python
!pip install numpy
!apt-get install build-essential
%pip install pandas
%conda install scikit-learn
```

**Imports** (moved to cell 1):

```python
import numpy as np
from sklearn.model_selection import train_test_split
```

## Known Limitations

- Multi-line imports with parentheses are not yet supported:

  ```python
  from sklearn import (    # ← not recognized
      train_test_split,
      cross_val_score,
  )
  ```

- `TYPE_CHECKING` blocks and conditional imports are treated as regular code

## Requirements

- VS Code `^1.109.0`
- [Jupyter extension](https://marketplace.visualstudio.com/items?itemName=ms-toolsai.jupyter) for opening `.ipynb` files

## License

MIT
