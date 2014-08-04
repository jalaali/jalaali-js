test:
	@mocha --reporter spec --ui bdd --check-leaks --no-exit test.js

.PHONY: test
