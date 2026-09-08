QUARTO ?= quarto
SITE_DIR := site

.PHONY: help check-quarto site site-preview

help:
	@echo "Available targets:"
	@echo "  make site          Render the Quarto website into site/_site"
	@echo "  make site-preview  Start a local website preview with live reload"

check-quarto:
	@command -v "$(QUARTO)" >/dev/null 2>&1 || { \
		echo "Quarto was not found: $(QUARTO)"; \
		echo "Install it from https://quarto.org/docs/get-started/"; \
		echo "Or pass an executable explicitly: make site-preview QUARTO=/path/to/quarto"; \
		exit 1; \
	}

site: check-quarto
	$(QUARTO) render $(SITE_DIR)

site-preview: check-quarto
	$(QUARTO) preview $(SITE_DIR)
