#!/bin/bash

usage() {
   echo "Usage:"
   echo "      $0 [-enable|-disable|-help] [<process>]"
}

if [ ! -d "/var/tmp/croncontrol/" ]; then
   "Cron control directory not found, creating folder.."
   mkdir "/var/tmp/croncontrol/"
fi

if [ $# -lt 2 ] ; then
   echo "process must be specified"
   usage
   exit 1
fi

case $1 in
   -enable|--enable|-e|--e)
      rm "/var/tmp/croncontrol/$2"
      exit 0
   ;;
   -disable|--disable|-d|--d)
      touch "/var/tmp/croncontrol/$2"
      exit 0
   ;;
   -help|--help|-h|--h)
      usage
      exit 0
   ;;
   -*|--*)
      echo "Error: no such option $1"
      usage
      exit 1
   ;;
   *)
      usage
      exit 1
   ;;
esac
exit 0