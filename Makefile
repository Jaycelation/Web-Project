.PHONY: install keys db dev test build verify up down manifest

install:
	npm ci

keys:
	npm run crypto:keys

db:
	npm run db:generate
	npm run db:deploy
	npm run db:seed

dev:
	npm run dev

test:
	npm test

build:
	npm run build

verify:
	npm run verify

up:
	docker compose up --build -d

down:
	docker compose down

manifest:
	( git ls-files -z --cached --others --exclude-standard -- . ':!:MANIFEST.sha256' \
	    | xargs -0 -r sh -c 'for file do [ ! -f "$$file" ] || printf "%s\0" "$$file"; done' sh; \
	  find packages -type f -path '*/dist/*' -print0 ) \
	  | LC_ALL=C sort -zu \
	  | xargs -0 sha256sum > MANIFEST.sha256
	sha256sum --check MANIFEST.sha256
