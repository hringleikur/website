function forEach(list, func, args)
{
  for (var i = 0; i < list.length; i++) {
      func.apply(list[i], args);
  }
}
