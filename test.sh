#!/bin/bash

docker run --rm --name clipshift-pwa -p 8080:80 -v "$PWD:/usr/share/nginx/html/web:ro" nginx
