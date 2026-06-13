# Convenience targets for driving the Pi kiosk from your laptop.
# (The dashboards themselves are built/run per-app; see each app's package.json.)

APP ?= family

.PHONY: help swap deploy
help:
	@echo "make swap APP=worldcup|family   # flip which dashboard the TV shows (commits kiosk.json + applies)"
	@echo "make deploy                      # push latest main to the Pi now (skip the ~10-min timer)"

swap:   ## Swap the TV dashboard (APP=worldcup|family)
	./pi/switch.sh $(APP)

deploy: ## Apply latest main on the Pi now
	./pi/deploy.sh
