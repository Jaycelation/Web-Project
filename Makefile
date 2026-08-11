.PHONY: install keys db dev test build up down

install:
	npm install

keys:
	npm run crypto:keys

db:
	npm run db:generate
	npm run db:push
	npm run db:seed

dev:
	npm run dev

test:
	npm test

build:
	npm run build

up:
	docker compose up --build

down:
	docker compose down
